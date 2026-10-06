using System.Numerics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace PlanToBee.API.Infrastructure.WebPush;

// Sunucu kimliği (VAPID, RFC 8292): push servisine "bu bildirimi PlanToBee gönderiyor" diye imzalı bir belirteç
// (ES256 JWT) sunulur. Tarayıcı aboneliği bu anahtarın ortak yarısına bağlanır; başka biri bu aboneliğe bildirim
// gönderemez.
//
// Özel anahtar repoda ya da yapılandırma dosyasında tutulmaz: Render'ın ürettiği gizli değerden (WebPush__Key)
// HKDF ile türetilir. Böylece anahtarı kimse elle üretmez, görmez ya da kopyalamaz. Değer değişirse tüm
// abonelikler geçersiz olur (cihazlar uygulamayı açınca yeniden abone olur).
public sealed class VapidKey : IDisposable
{
    // P-256 grubunun derecesi (n). Özel anahtar 1..n-1 aralığında olmalı.
    private static readonly BigInteger Order = BigInteger.Parse(
        "0FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551", System.Globalization.NumberStyles.HexNumber);

    private readonly ECDsa _key;
    private readonly string _subject;

    // Tarayıcıya verilen ortak anahtar (applicationServerKey), base64url.
    public string PublicKey { get; }

    private VapidKey(byte[] d, string subject)
    {
        _key = ECDsa.Create(new ECParameters { Curve = ECCurve.NamedCurves.nistP256, D = d });
        var q = _key.ExportParameters(false).Q;
        PublicKey = Base64Url.Encode([0x04, .. q.X!, .. q.Y!]);
        _subject = subject;
    }

    public static VapidKey FromSecret(string secret, string subject)
    {
        // Geçerli bir skaler çıkana kadar sayaçla türet (olasılık olarak ilk denemede çıkar).
        for (byte i = 0; ; i++)
        {
            var d = HKDF.DeriveKey(HashAlgorithmName.SHA256, Encoding.UTF8.GetBytes(secret), 32,
                info: Encoding.UTF8.GetBytes($"PlanToBee VAPID key v1/{i}"));
            var value = new BigInteger(d, isUnsigned: true, isBigEndian: true);
            if (value > 0 && value < Order) return new VapidKey(d, subject);
        }
    }

    // Authorization başlığı: "vapid t=<jwt>, k=<ortak anahtar>". aud: endpoint'in kökeni; geçerlilik 12 saat
    // (RFC 8292 en fazla 24 saat önerir).
    public string AuthorizationHeader(Uri endpoint, DateTimeOffset now)
    {
        var header = Base64Url.Encode(Encoding.UTF8.GetBytes("{\"typ\":\"JWT\",\"alg\":\"ES256\"}"));
        var claims = Base64Url.Encode(JsonSerializer.SerializeToUtf8Bytes(new Dictionary<string, object>
        {
            ["aud"] = endpoint.GetLeftPart(UriPartial.Authority),
            ["exp"] = now.AddHours(12).ToUnixTimeSeconds(),
            ["sub"] = _subject
        }));
        var signingInput = $"{header}.{claims}";
        // ES256: ham r|s (64 bayt), DER değil.
        var signature = _key.SignData(Encoding.ASCII.GetBytes(signingInput), HashAlgorithmName.SHA256,
            DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
        return $"vapid t={signingInput}.{Base64Url.Encode(signature)}, k={PublicKey}";
    }

    // Test için: imzayı ortak anahtarla doğrular.
    public bool Verify(string jwt)
    {
        var parts = jwt.Split('.');
        return parts.Length == 3 && _key.VerifyData(Encoding.ASCII.GetBytes($"{parts[0]}.{parts[1]}"),
            Base64Url.Decode(parts[2]), HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
    }

    public void Dispose() => _key.Dispose();
}
