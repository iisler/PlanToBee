using System.Net;
using Microsoft.AspNetCore.HttpOverrides;

namespace PlanToBee.API.Infrastructure;

// Ters proxy (Render) arkasında gerçek istemci IP'si ve HTTPS bilgisi.
//
// Ayarlar (ForwardedHeaders bölümü, ortam değişkeni ForwardedHeaders__...):
//   Enabled        : false (varsayılan, yerel geliştirme) -> başlıklar yok sayılır, doğrudan bağlantı IP'si kullanılır.
//   ForwardLimit   : X-Forwarded-For listesinde SAĞDAN kaç girişin işleneceği (varsayılan 1).
//                    1 = yalnızca en sağdaki, yani bize bağlanan proxy'nin eklediği değer kullanılır. İstemcinin
//                    kendi gönderdiği (soldaki) değerler dikkate alınmaz; sahte başlıkla IP değiştirilemez.
//   KnownProxies   : Güvenilen proxy IP'leri (virgülle ayrılmış). Boşsa bağlantıyı kuran her adres proxy sayılır.
//   KnownNetworks  : Güvenilen proxy ağları, CIDR (örn. 10.0.0.0/8). Boşsa yukarıdaki gibi.
//   LogDiagnostics : true ise her istekte ham X-Forwarded-For giriş sayısı ve çözümlenen IP loglanır
//                    (yalnızca kurulumda doğru ForwardLimit'i görmek için geçici olarak açın).
//
// Render'da proxy IP aralığı sabit/yayınlanmış olmadığı için KnownProxies/KnownNetworks boş bırakılır. Bu,
// ancak uygulamaya internetten yalnızca Render proxy'si üzerinden erişilebildiği için güvenlidir; asıl koruma
// ForwardLimit=1'dir. (Uygulama doğrudan internete açık bir sunucuda çalıştırılırsa Enabled=false kalmalı ya da
// KnownProxies doldurulmalıdır.)
public class ForwardedHeadersSettings
{
    public const string Section = "ForwardedHeaders";

    public bool Enabled { get; set; }
    public int ForwardLimit { get; set; } = 1;
    public string? KnownProxies { get; set; }
    public string? KnownNetworks { get; set; }
    public bool LogDiagnostics { get; set; }

    public static ForwardedHeadersSettings Read(IConfiguration config, List<string> errors)
    {
        var s = new ForwardedHeadersSettings();
        var section = config.GetSection(Section);
        if (!TryBool(section["Enabled"], false, out var enabled))
            errors.Add("ForwardedHeaders:Enabled true ya da false olmalı.");
        if (!TryBool(section["LogDiagnostics"], false, out var diag))
            errors.Add("ForwardedHeaders:LogDiagnostics true ya da false olmalı.");
        s.Enabled = enabled;
        s.LogDiagnostics = diag;

        var limitRaw = section["ForwardLimit"];
        if (!string.IsNullOrWhiteSpace(limitRaw))
        {
            if (int.TryParse(limitRaw, out var limit) && limit is >= 1 and <= 10) s.ForwardLimit = limit;
            else errors.Add("ForwardedHeaders:ForwardLimit 1 ile 10 arasında bir sayı olmalı (Render için 1).");
        }

        s.KnownProxies = section["KnownProxies"];
        s.KnownNetworks = section["KnownNetworks"];
        foreach (var p in Split(s.KnownProxies))
            if (!IPAddress.TryParse(p, out _)) errors.Add("ForwardedHeaders:KnownProxies içinde geçersiz IP adresi var.");
        foreach (var n in Split(s.KnownNetworks))
            if (!System.Net.IPNetwork.TryParse(n, out _)) errors.Add("ForwardedHeaders:KnownNetworks içinde geçersiz ağ (CIDR) var.");
        return s;
    }

    public void Apply(ForwardedHeadersOptions o)
    {
        o.ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor |
                             Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto;
        o.ForwardLimit = ForwardLimit;
        // Varsayılan liste yalnızca loopback'e güvenir; Render proxy'si loopback değildir.
        o.KnownProxies.Clear();
        o.KnownIPNetworks.Clear();
        foreach (var p in Split(KnownProxies)) o.KnownProxies.Add(IPAddress.Parse(p));
        foreach (var n in Split(KnownNetworks)) o.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(n));
        // X-Forwarded-Host işlenmez: uygulama adres üretirken Host başlığını kullanmaz (e-posta linkleri
        // App:FrontendBaseUrl ayarından gelir), bu yüzden istemcinin Host'u değiştirmesinin etkisi yoktur.
    }

    private static IEnumerable<string> Split(string? v) =>
        (v ?? "").Split([',', ';', ' '], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private static bool TryBool(string? raw, bool fallback, out bool value)
    {
        if (string.IsNullOrWhiteSpace(raw)) { value = fallback; return true; }
        return bool.TryParse(raw, out value);
    }
}

public static class ForwardedHeadersExtensions
{
    public static IApplicationBuilder UsePlanToBeeForwardedHeaders(this WebApplication app, ForwardedHeadersSettings s)
    {
        if (!s.Enabled) return app;

        if (s.LogDiagnostics)
        {
            var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("ForwardedHeaders");
            app.Use(async (ctx, next) =>
            {
                var peer = ctx.Connection.RemoteIpAddress;
                var xff = ctx.Request.Headers["X-Forwarded-For"].ToString();
                var entries = xff.Split(',', StringSplitOptions.RemoveEmptyEntries).Length;
                await next();
                // Tanı amaçlı: ham başlık ve çözümlenen IP (kişisel veri sayılabilir, kalıcı açık tutmayın).
                logger.LogInformation(
                    "Forwarded tanı: {Path} bağlanan={Peer} XFF girişleri={Count} XFF='{Xff}' çözümlenen={Resolved} https={Https}",
                    ctx.Request.Path, peer, entries, xff, ctx.Connection.RemoteIpAddress, ctx.Request.IsHttps);
            });
        }

        var options = new ForwardedHeadersOptions();
        s.Apply(options);
        return app.UseForwardedHeaders(options);
    }
}
