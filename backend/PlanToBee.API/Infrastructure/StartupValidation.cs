using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;

namespace PlanToBee.API.Infrastructure;

// Açılışta ayar doğrulaması. Geliştirme ortamında yalnızca çalışmayı imkansız kılan hatalar (JWT anahtarı,
// okunamayan bağlantı dizesi) durdurur; üretimde (Development dışındaki her ortam) zorunlu ayarların hepsi
// kontrol edilir. Hatalar toplu listelenir ve API durur. Mesajlar ayar adını söyler, değerini asla içermez.
public class StartupValidation
{
    public List<string> Errors { get; } = [];
    public List<string> Warnings { get; } = [];
    public string? ConnectionString { get; private set; }
    public string JwtKey { get; private set; } = "";
    public bool UseSmtp { get; private set; }
    public int? Port { get; private set; }
    public ForwardedHeadersSettings Forwarded { get; private set; } = new();

    // 2026-09 repo geçmişinde (664694a) açık metin olarak bulunan eski JWT anahtarının SHA-256 özeti.
    // Bu değer herkese açık olduğu için hiçbir ortamda kabul edilmez.
    private const string LeakedJwtKeySha256 = "66ecf276720177d083e43f22abbb5bb323d872d43d6224d0fc74a19c333af07f";

    public static StartupValidation Run(IConfiguration config, IHostEnvironment env)
    {
        var v = new StartupValidation();
        var strict = !env.IsDevelopment();

        // ---- JWT ----
        var jwtKey = config["Jwt:Key"];
        if (string.IsNullOrEmpty(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
            v.Errors.Add("Jwt:Key (ortam değişkeni: Jwt__Key) ayarlı değil veya 32 karakterden kısa. " +
                         (strict ? "En az 32, tercihen 64 karakterlik rastgele bir değer girin (docs/DEPLOY.md)."
                                 : "Yerelde: dotnet user-secrets set \"Jwt:Key\" \"<uzun-rastgele-değer>\""));
        else if (Sha256(jwtKey) == LeakedJwtKeySha256)
            v.Errors.Add("Jwt:Key repo geçmişinde açıkça yer almış eski anahtar. Yeni, rastgele bir anahtar üretin.");
        else
            v.JwtKey = jwtKey;
        if (strict && string.IsNullOrWhiteSpace(config["Jwt:Issuer"]))
            v.Errors.Add("Jwt:Issuer boş.");
        if (strict && string.IsNullOrWhiteSpace(config["Jwt:Audience"]))
            v.Errors.Add("Jwt:Audience boş.");

        // ---- Veritabanı ----
        var db = DatabaseConnection.Build(config.GetConnectionString("Default"), requireSsl: strict);
        v.Errors.AddRange(db.Errors);
        v.Warnings.AddRange(db.Warnings);
        v.ConnectionString = db.ConnectionString;

        // ---- E-posta ----
        var provider = config["Email:Provider"];
        v.UseSmtp = string.Equals(provider, "Smtp", StringComparison.OrdinalIgnoreCase);
        if (strict)
        {
            if (!v.UseSmtp)
                v.Errors.Add("Email:Provider üretimde 'Smtp' olmalı (şu an: " +
                             (string.IsNullOrWhiteSpace(provider) ? "boş" : Safe(provider)) +
                             "). 'Log' sağlayıcısı e-posta göndermez ve linkleri loga yazar.");
            else
            {
                if (string.IsNullOrWhiteSpace(config["Email:Smtp:Host"]))
                    v.Errors.Add("Email:Smtp:Host (Email__Smtp__Host) ayarlı değil. Brevo için: smtp-relay.brevo.com");
                var portRaw = config["Email:Smtp:Port"];
                if (!int.TryParse(portRaw, out var smtpPort) || smtpPort is < 1 or > 65535)
                    v.Errors.Add("Email:Smtp:Port (Email__Smtp__Port) geçerli bir port değil. Brevo için: 587");
                if (!bool.TryParse(config["Email:Smtp:EnableSsl"] ?? "true", out var ssl) || !ssl)
                    v.Errors.Add("Email:Smtp:EnableSsl üretimde true olmalı (STARTTLS ile şifreli bağlantı).");
                if (string.IsNullOrWhiteSpace(config["Email:Smtp:Username"]))
                    v.Errors.Add("Email:Smtp:Username (Email__Smtp__Username) ayarlı değil. Brevo > SMTP & API ekranındaki 'Login' değeri.");
                if (string.IsNullOrWhiteSpace(config["Email:Smtp:Password"]))
                    v.Errors.Add("Email:Smtp:Password (Email__Smtp__Password) ayarlı değil. Brevo'da oluşturulan SMTP anahtarı.");
            }
            var from = config["Email:From"];
            if (string.IsNullOrWhiteSpace(from) || !IsEmail(from))
                v.Errors.Add("Email:From (Email__From) ayarlı değil veya geçerli bir e-posta adresi değil. Brevo'da doğrulanmış gönderen adresi olmalı.");
        }

        // ---- Frontend adresi (e-posta linkleri ve CORS) ----
        var frontend = config["App:FrontendBaseUrl"];
        if (strict)
        {
            if (string.IsNullOrWhiteSpace(frontend) ||
                !Uri.TryCreate(frontend.Trim(), UriKind.Absolute, out var fu) ||
                fu.Scheme != Uri.UriSchemeHttps || fu.IsLoopback ||
                fu.AbsolutePath != "/" || fu.Query.Length > 0 || fu.Fragment.Length > 0 || fu.UserInfo.Length > 0)
                v.Errors.Add("App:FrontendBaseUrl (App__FrontendBaseUrl) ayarlı değil veya geçerli değil. " +
                             "https:// ile başlayan, yol içermeyen frontend adresi olmalı (örn. https://plantobee.pages.dev).");
        }
        else if (string.IsNullOrWhiteSpace(frontend) || !Uri.TryCreate(frontend, UriKind.Absolute, out _))
            v.Errors.Add("App:FrontendBaseUrl geçerli bir adres değil.");

        // ---- Proxy / forwarded header ----
        v.Forwarded = ForwardedHeadersSettings.Read(config, v.Errors);
        if (strict && !v.Forwarded.Enabled)
            v.Warnings.Add("ForwardedHeaders:Enabled=false: proxy arkasında tüm istekler proxy'nin IP'sinden geliyormuş gibi görünür " +
                           "ve IP bazlı sınırlar bütün kullanıcılar arasında paylaşılır. Render'da true olmalı.");

        // ---- Rate limit (isteğe bağlı) ----
        foreach (var key in new[] { "Auth", "InvitePublic", "InviteSend", "Session" })
        {
            var raw = config[$"RateLimits:{key}"];
            if (!string.IsNullOrWhiteSpace(raw) && (!int.TryParse(raw, out var n) || n < 1))
                v.Errors.Add($"RateLimits:{key} pozitif bir tam sayı olmalı.");
        }

        // ---- Port (Render PORT ortam değişkeni) ----
        var port = config["PORT"];
        if (!string.IsNullOrWhiteSpace(port))
        {
            if (int.TryParse(port, out var p) && p is >= 1 and <= 65535) v.Port = p;
            else v.Errors.Add("PORT geçerli bir port numarası değil (1-65535).");
        }

        return v;
    }

    public void WriteErrors(TextWriter w, string environment)
    {
        w.WriteLine($"PlanToBee API başlatılamadı ({environment}): {Errors.Count} ayar hatası bulundu.");
        foreach (var e in Errors) w.WriteLine("  - " + e);
        w.WriteLine("Ayarların listesi ve örnek değerler: docs/DEPLOY.md > Ortam değişkenleri.");
    }

    private static bool IsEmail(string s)
    {
        try { return new MailAddress(s.Trim()).Address == s.Trim(); }
        catch (FormatException) { return false; }
    }

    // Kullanıcının girdiği sağlayıcı adı mesajda gösterilir; kısa ve basit tutulur.
    private static string Safe(string s) => s.Length > 20 || !s.All(char.IsLetterOrDigit) ? "geçersiz değer" : s;

    private static string Sha256(string s) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(s)));
}
