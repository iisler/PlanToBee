using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace PlanToBee.API.Infrastructure;

// IP ve kullanıcı bazlı istek sınırları (kaba kuvvet ve e-posta bombardımanına karşı).
public static class RateLimitPolicies
{
    public const string Auth = "auth";              // kayıt, giriş, doğrulama, şifre sıfırlama
    public const string InvitePublic = "invite-public"; // davet linki/kodu doğrulama ve kabul
    public const string InviteSend = "invite-send";     // davet gönderme / yeniden gönderme
    public const string Session = "session";            // oturum bilgisi (/auth/me): kullanıcı başına geniş sınır
    public const string Api = "api";                    // plan ve aile uç noktaları: kullanıcı başına geniş sınır

    // Varsayılan sınırlar RateLimits:Auth / InvitePublic / InviteSend ayarlarıyla değiştirilebilir.
    public static IServiceCollection AddPlanToBeeRateLimiting(this IServiceCollection services, IConfiguration config)
    {
        var authLimit = config.GetValue("RateLimits:Auth", 20);                 // IP başına / dakika
        var invitePublicLimit = config.GetValue("RateLimits:InvitePublic", 10); // IP başına / 5 dakika
        var inviteSendLimit = config.GetValue("RateLimits:InviteSend", 20);     // kullanıcı başına / saat
        var sessionLimit = config.GetValue("RateLimits:Session", 120);          // kullanıcı başına / dakika
        var apiLimit = config.GetValue("RateLimits:Api", 300);                  // kullanıcı başına / dakika
        return services.AddRateLimiter(o =>
        {
            o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            o.OnRejected = async (ctx, ct) =>
            {
                ctx.HttpContext.Response.ContentType = "application/json; charset=utf-8";
                await ctx.HttpContext.Response.WriteAsJsonAsync(
                    new ApiError("rate_limited", "Çok fazla istek gönderildi. Biraz bekleyip tekrar dene."), ct);
            };

            o.AddPolicy(Auth, ctx => RateLimitPartition.GetFixedWindowLimiter(
                "auth:" + Ip(ctx),
                _ => new FixedWindowRateLimiterOptions { PermitLimit = authLimit, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

            // 6 haneli kodun tahmin edilmesini zorlaştırır (davet başına 5 hatalı deneme sınırına ek olarak).
            o.AddPolicy(InvitePublic, ctx => RateLimitPartition.GetFixedWindowLimiter(
                "invite:" + Ip(ctx),
                _ => new FixedWindowRateLimiterOptions { PermitLimit = invitePublicLimit, Window = TimeSpan.FromMinutes(5), QueueLimit = 0 }));

            o.AddPolicy(InviteSend, ctx => RateLimitPartition.GetFixedWindowLimiter(
                "invite-send:" + (ctx.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? Ip(ctx)),
                _ => new FixedWindowRateLimiterOptions { PermitLimit = inviteSendLimit, Window = TimeSpan.FromHours(1), QueueLimit = 0 }));

            // /auth/me giriş sınırından ayrıdır: aynı ev ağındaki (aynı IP) aile üyeleri birbirini engellemesin.
            // Bölümleme kullanıcıya göredir; oturumsuz istek IP'ye göre bölümlenir.
            o.AddPolicy(Session, ctx => RateLimitPartition.GetFixedWindowLimiter(
                "session:" + (ctx.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? Ip(ctx)),
                _ => new FixedWindowRateLimiterOptions { PermitLimit = sessionLimit, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

            // Gün/hafta, ders listesi ve aile uç noktaları. Normal kullanım bu sınıra yaklaşmaz; tek bir hesabın
            // (ya da çalınmış bir token'ın) API'yi ve veritabanını sınırsız istekle meşgul etmesini engeller.
            o.AddPolicy(Api, ctx => RateLimitPartition.GetFixedWindowLimiter(
                "api:" + (ctx.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? Ip(ctx)),
                _ => new FixedWindowRateLimiterOptions { PermitLimit = apiLimit, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
        });
    }

    // İstemci IP'si. Proxy arkasında (ForwardedHeaders:Enabled=true) bu değer UseForwardedHeaders tarafından,
    // yalnızca güvenilen proxy'nin eklediği X-Forwarded-For girişinden belirlenir (ForwardedHeadersSetup.cs).
    // IPv6 adresleri /64 önekine göre gruplanır: tek bir ev/abone genelde bütün bir /64 bloğuna sahiptir ve
    // blok içindeki adresleri değiştirerek sınırları atlatabilirdi.
    internal static string Ip(HttpContext ctx) => PartitionKey(ctx.Connection.RemoteIpAddress);

    internal static string PartitionKey(System.Net.IPAddress? ip)
    {
        if (ip == null) return "unknown";
        if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
        if (ip.AddressFamily != System.Net.Sockets.AddressFamily.InterNetworkV6) return ip.ToString();
        var bytes = ip.GetAddressBytes();
        Array.Clear(bytes, 8, 8);
        return new System.Net.IPAddress(bytes) + "/64";
    }
}
