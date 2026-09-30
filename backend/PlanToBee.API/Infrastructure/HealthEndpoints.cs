using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using PlanToBee.API.Data;

namespace PlanToBee.API.Infrastructure;

// Kimlik doğrulama gerektirmeyen sağlık kontrolü.
//   GET /health       -> API + veritabanı. 200 {"status":"ok","api":"ok","database":"ok"}
//                        veritabanına ulaşılamazsa 503 {"status":"unhealthy","api":"ok","database":"unreachable"}
//   GET /health/live  -> yalnızca API sürecinin ayakta olduğu (veritabanına dokunmaz).
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
        app.MapHealthChecks("/health", new HealthCheckOptions
        {
            Predicate = _ => true,
            ResponseWriter = (ctx, report) =>
            {
                var db = report.Entries.TryGetValue(DbCheck, out var e) && e.Status == HealthStatus.Healthy ? "ok" : "unreachable";
                ctx.Response.ContentType = "application/json; charset=utf-8";
                ctx.Response.Headers.CacheControl = "no-store";
                return ctx.Response.WriteAsJsonAsync(new
                {
                    status = report.Status == HealthStatus.Healthy ? "ok" : "unhealthy",
                    api = "ok",
                    database = db
                });
            }
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
