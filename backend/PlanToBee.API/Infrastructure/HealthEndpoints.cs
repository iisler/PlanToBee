using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using PlanToBee.API.Data;

namespace PlanToBee.API.Infrastructure;

// Kimlik doğrulama gerektirmeyen sağlık kontrolü.
//   GET /health       -> API; veritabanı yalnızca anahtarla (Health:Key = X-Health-Key başlığı ya da ?key=) kontrol edilir:
//                        200 {"status":"ok","api":"ok","database":"ok"}, ulaşılamazsa 503 {..."database":"unreachable"}.
//                        Anahtarsız istek veritabanına dokunmaz: 200 {"status":"ok","api":"ok","database":"unchecked"}.
//                        Herkese açık bu adres sık çağrılarak Neon uyutulmadan tutulamasın, ücretsiz planın aylık işlem
//                        süresi tüketilemesin (docs/backend-inceleme.md, O4). Anahtar ayarlı değilse veritabanı yalnızca
//                        geliştirmede kontrol edilir.
//   GET /health/live  -> yalnızca API sürecinin ayakta olduğu (veritabanına dokunmaz). Render bunu kullanır.
// Cevap gizli bilgi (bağlantı dizesi, sunucu adı, hata mesajı/yığını) içermez; ayrıntı yalnızca sunucu loguna yazılır.
// Rate limit politikası uygulanmaz (genel bir limiter tanımlı değil), Render'ın düzenli kontrolünü engellemez.
public static class HealthEndpoints
{
    private const string DbCheck = "database";

    public static IServiceCollection AddPlanToBeeHealthChecks(this IServiceCollection services)
    {
        services.AddHealthChecks().AddCheck<DatabaseHealthCheck>(DbCheck, tags: ["db"]);
        return services;
    }

    public static void MapPlanToBeeHealthChecks(this WebApplication app)
    {
        app.MapGet("/health", async (HttpContext ctx, HealthCheckService health, IConfiguration config, IWebHostEnvironment env) =>
        {
            ctx.Response.Headers.CacheControl = "no-store";
            if (!CanCheckDatabase(ctx, config, env))
                return Results.Json(new { status = "ok", api = "ok", database = "unchecked" });
            var report = await health.CheckHealthAsync(r => r.Tags.Contains("db"), ctx.RequestAborted);
            var ok = report.Status == HealthStatus.Healthy;
            return Results.Json(new { status = ok ? "ok" : "unhealthy", api = "ok", database = ok ? "ok" : "unreachable" },
                statusCode: ok ? StatusCodes.Status200OK : StatusCodes.Status503ServiceUnavailable);
        });

        app.MapHealthChecks("/health/live", new HealthCheckOptions
        {
            Predicate = _ => false,
            ResponseWriter = (ctx, _) =>
            {
                ctx.Response.ContentType = "application/json; charset=utf-8";
                ctx.Response.Headers.CacheControl = "no-store";
                return ctx.Response.WriteAsJsonAsync(new { status = "ok", api = "ok" });
            }
        });
    }

    // Veritabanı kontrol edilsin mi: anahtar ayarlıysa istekteki anahtar eşleşmeli; ayarlı değilse yalnızca geliştirmede.
    internal static bool CanCheckDatabase(HttpContext ctx, IConfiguration config, IHostEnvironment env)
    {
        var key = config["Health:Key"];
        if (string.IsNullOrEmpty(key)) return env.IsDevelopment();
        var given = ctx.Request.Headers["X-Health-Key"].FirstOrDefault() ?? ctx.Request.Query["key"].FirstOrDefault();
        return given != null && SecureCodes.FixedTimeEquals(given, key);
    }
}

// Hafif kontrol: bağlantı açılabiliyor mu (CanConnect, sorgu çalıştırmaz). 5 sn zaman aşımı.
public class DatabaseHealthCheck(AppDbContext db, ILogger<DatabaseHealthCheck> logger) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromSeconds(5));
        try
        {
            if (await db.Database.CanConnectAsync(cts.Token)) return HealthCheckResult.Healthy();
            logger.LogWarning("Sağlık kontrolü: veritabanına bağlanılamadı.");
        }
        catch (Exception ex)
        {
            // Yalnızca istisna türü loglanır; mesaj sunucu adı içerebilir.
            logger.LogWarning("Sağlık kontrolü: veritabanı hatası ({Type}).", ex.GetType().Name);
        }
        return HealthCheckResult.Unhealthy();
    }
}
