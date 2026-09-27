using Npgsql;

namespace PlanToBee.API.Infrastructure;

// ConnectionStrings:Default değerini Npgsql bağlantı dizesine çevirir.
// İki biçim kabul edilir:
//   1) URI (Neon'un verdiği biçim): postgres://kullanici:sifre@host[:port]/veritabani?sslmode=require&channel_binding=require
//   2) Npgsql anahtar=değer biçimi (yerel geliştirme): Host=localhost;Database=plantobee;Username=...;Password=...
// Üretimde (requireSsl=true) SSL zorunludur: sslmode=disable reddedilir; belirtilmemiş / prefer / allow / require
// değerleri VerifyFull'a yükseltilir (şifreleme + sertifika ve sunucu adı doğrulaması).
// Hata ve uyarı mesajları bağlantı dizesinin kendisini (şifre, sunucu adı) içermez.
public static class DatabaseConnection
{
    public record Result(string? ConnectionString, List<string> Errors, List<string> Warnings);

    public static Result Build(string? raw, bool requireSsl)
    {
        var errors = new List<string>();
        var warnings = new List<string>();
        if (string.IsNullOrWhiteSpace(raw))
        {
            errors.Add("ConnectionStrings:Default (ortam değişkeni: ConnectionStrings__Default) ayarlı değil. " +
                       "Neon'daki bağlantı adresini (postgres://...) girin.");
            return new Result(null, errors, warnings);
        }

        NpgsqlConnectionStringBuilder sb;
        raw = raw.Trim();
        if (raw.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
            raw.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            var parsed = FromUri(raw, errors, warnings);
            if (parsed == null) return new Result(null, errors, warnings);
            sb = parsed;
        }
        else
        {
            try { sb = new NpgsqlConnectionStringBuilder(raw); }
            catch (Exception)
            {
                // İstisna mesajı değerleri içerebileceği için loglanmaz.
                errors.Add("ConnectionStrings:Default okunamadı: biçim hatalı. " +
                           "postgres://kullanici:sifre@host/veritabani?sslmode=require biçimini kullanın.");
                return new Result(null, errors, warnings);
            }
        }

        if (string.IsNullOrWhiteSpace(sb.Host))
            errors.Add("ConnectionStrings:Default içinde sunucu (host) yok.");
        if (string.IsNullOrWhiteSpace(sb.Database))
            errors.Add("ConnectionStrings:Default içinde veritabanı adı yok.");

        if (requireSsl)
        {
            switch (sb.SslMode)
            {
                case SslMode.Disable:
                    errors.Add("ConnectionStrings:Default SSL'i kapatıyor (sslmode=disable). Üretimde veritabanı bağlantısı SSL olmadan kurulamaz; " +
                               "sslmode=require kullanın ya da sslmode parametresini silin.");
                    break;
                case SslMode.Allow:
                case SslMode.Prefer:
                case SslMode.Require:
                    // Belirtilmemişse Npgsql varsayılanı Prefer'dir (SSL'siz bağlantıya düşebilir). Üretimde
                    // sertifikası doğrulanan zorunlu SSL kullanılır. Neon'un sertifikası genel kabul görmüş
                    // bir kök sertifikayla imzalandığı için ek ayar gerekmez.
                    sb.SslMode = SslMode.VerifyFull;
                    break;
            }

            if (sb.Host?.Contains("-pooler.", StringComparison.OrdinalIgnoreCase) == true)
                warnings.Add("Veritabanı adresi Neon'un havuzlu (pooled, '-pooler') adresi gibi görünüyor. " +
                             "Açılış migration'ları için doğrudan (direct) bağlantı adresi önerilir (docs/DEPLOY.md).");
        }

        return new Result(errors.Count == 0 ? sb.ConnectionString : null, errors, warnings);
    }

    private static NpgsqlConnectionStringBuilder? FromUri(string raw, List<string> errors, List<string> warnings)
    {
        if (!Uri.TryCreate(raw, UriKind.Absolute, out var uri) || string.IsNullOrEmpty(uri.Host))
        {
            errors.Add("ConnectionStrings:Default bir postgres:// adresi gibi görünüyor ama okunamadı. " +
                       "Biçim: postgres://kullanici:sifre@host/veritabani?sslmode=require (şifrede özel karakter varsa URL-kodlu olmalı).");
            return null;
        }

        var sb = new NpgsqlConnectionStringBuilder { Host = uri.IdnHost };
        if (uri.Port > 0) sb.Port = uri.Port;

        var userInfo = uri.UserInfo;
        if (!string.IsNullOrEmpty(userInfo))
        {
            var sep = userInfo.IndexOf(':');
            sb.Username = Uri.UnescapeDataString(sep < 0 ? userInfo : userInfo[..sep]);
            if (sep >= 0) sb.Password = Uri.UnescapeDataString(userInfo[(sep + 1)..]);
        }
        if (string.IsNullOrEmpty(sb.Username))
            errors.Add("ConnectionStrings:Default adresinde kullanıcı adı yok (postgres://kullanici:sifre@...).");

        sb.Database = Uri.UnescapeDataString(uri.AbsolutePath.Trim('/'));

        var query = uri.Query.TrimStart('?');
        foreach (var part in query.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var eq = part.IndexOf('=');
            var key = Uri.UnescapeDataString(eq < 0 ? part : part[..eq]).Trim().ToLowerInvariant();
            var value = eq < 0 ? "" : Uri.UnescapeDataString(part[(eq + 1)..]).Trim();
            switch (key)
            {
                case "sslmode":
                    var mode = ParseSslMode(value);
                    if (mode == null) errors.Add("ConnectionStrings:Default: sslmode değeri tanınmadı (disable, allow, prefer, require, verify-ca, verify-full).");
                    else sb.SslMode = mode.Value;
                    break;
                case "channel_binding":
                    var cb = value.ToLowerInvariant() switch
                    {
                        "disable" => ChannelBinding.Disable,
                        "prefer" => ChannelBinding.Prefer,
                        "require" => ChannelBinding.Require,
                        _ => (ChannelBinding?)null
                    };
                    if (cb == null) errors.Add("ConnectionStrings:Default: channel_binding değeri tanınmadı (disable, prefer, require).");
                    else sb.ChannelBinding = cb.Value;
                    break;
                case "sslrootcert":
                    sb.RootCertificate = value;
                    break;
                case "connect_timeout":
                    if (int.TryParse(value, out var t) && t >= 0) sb.Timeout = t;
                    else errors.Add("ConnectionStrings:Default: connect_timeout bir sayı olmalı.");
                    break;
                case "application_name":
                    sb.ApplicationName = value;
                    break;
                case "options":
                    sb.Options = value;
                    break;
                default:
                    // Değer loglanmaz, yalnızca parametre adı.
                    warnings.Add($"ConnectionStrings:Default: '{key}' parametresi desteklenmiyor, yok sayıldı.");
                    break;
            }
        }
        return sb;
    }

    private static SslMode? ParseSslMode(string value) => value.ToLowerInvariant() switch
    {
        "disable" => SslMode.Disable,
        "allow" => SslMode.Allow,
        "prefer" => SslMode.Prefer,
        "require" => SslMode.Require,
        "verify-ca" => SslMode.VerifyCA,
        "verify-full" => SslMode.VerifyFull,
        _ => null
    };
}
