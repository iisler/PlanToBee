using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;

namespace PlanToBee.API.Infrastructure.WebPush;

// Web Push mesaj şifrelemesi (RFC 8291, "aes128gcm" içerik kodlaması, RFC 8188). Dış paket kullanılmaz;
// yalnızca .NET'in yerleşik kriptografisi: ECDH P-256, HKDF-SHA256, AES-128-GCM.
//
// İçeriği yalnızca aboneliği oluşturan tarayıcı çözebilir (tarayıcının ortak anahtarı ve auth sırrıyla).
// Push servisi (Apple, Google, Mozilla) yalnızca şifreli baytları taşır.
// Doğruluk RFC 8291 bölüm 5'teki test vektörüyle sınanır (backend/tests/WebPushSelfTest).
public static class WebPushCrypto
{
    private const int RecordSize = 4096;
    private const int TagSize = 16;

    // payload: bildirim içeriği (JSON). uaPublic: tarayıcının ortak anahtarı (65 bayt, sıkıştırılmamış nokta).
    // authSecret: tarayıcının auth sırrı (16 bayt). Testler için geçici anahtar ve salt dışarıdan verilebilir.
    public static byte[] Encrypt(byte[] payload, byte[] uaPublic, byte[] authSecret,
        ECDiffieHellman? senderKey = null, byte[]? salt = null)
    {
        if (uaPublic.Length != 65 || uaPublic[0] != 0x04) throw new CryptographicException("Geçersiz tarayıcı anahtarı (p256dh).");
        if (authSecret.Length != 16) throw new CryptographicException("Geçersiz auth sırrı.");
        // Tek kayıt: içerik + 1 bayt sınırlayıcı + etiket, kayıt boyutunu aşamaz.
        if (payload.Length + 1 + TagSize > RecordSize) throw new ArgumentException("Bildirim içeriği çok uzun.");

        using var ownKey = senderKey == null ? ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256) : null;
        var asKey = senderKey ?? ownKey!;
        salt ??= RandomNumberGenerator.GetBytes(16);
        if (salt.Length != 16) throw new ArgumentException("Salt 16 bayt olmalı.");

        var asPublic = ExportPublic(asKey);
        using var uaKey = ImportPublic(uaPublic);
        var ecdhSecret = asKey.DeriveRawSecretAgreement(uaKey.PublicKey);

        // RFC 8291 bölüm 3.4: IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info" || 0 || ua_public || as_public, 32)
        var keyInfo = Concat(Encoding.ASCII.GetBytes("WebPush: info\0"), uaPublic, asPublic);
        var prkKey = HKDF.Extract(HashAlgorithmName.SHA256, ecdhSecret, authSecret);
        var ikm = HKDF.Expand(HashAlgorithmName.SHA256, prkKey, 32, keyInfo);

        // RFC 8188 bölüm 2.2-2.3: içerik anahtarı ve nonce
        var prk = HKDF.Extract(HashAlgorithmName.SHA256, ikm, salt);
        var cek = HKDF.Expand(HashAlgorithmName.SHA256, prk, 16, Encoding.ASCII.GetBytes("Content-Encoding: aes128gcm\0"));
        var nonce = HKDF.Expand(HashAlgorithmName.SHA256, prk, 12, Encoding.ASCII.GetBytes("Content-Encoding: nonce\0"));

        // Son (ve tek) kayıt: içerik + 0x02 sınırlayıcı, dolgu yok.
        var plain = new byte[payload.Length + 1];
        payload.CopyTo(plain, 0);
        plain[^1] = 0x02;

        // Başlık: salt (16) | kayıt boyutu (4, big-endian) | anahtar uzunluğu (1) | gönderen ortak anahtarı (65)
        var header = new byte[16 + 4 + 1 + asPublic.Length];
        salt.CopyTo(header, 0);
        BinaryPrimitives.WriteUInt32BigEndian(header.AsSpan(16, 4), RecordSize);
        header[20] = (byte)asPublic.Length;
        asPublic.CopyTo(header, 21);

        var body = new byte[header.Length + plain.Length + TagSize];
        header.CopyTo(body, 0);
        using (var aes = new AesGcm(cek, TagSize))
            aes.Encrypt(nonce, plain, body.AsSpan(header.Length, plain.Length), body.AsSpan(header.Length + plain.Length, TagSize));
        return body;
    }

    // Yalnızca testler için: tarayıcı tarafının yaptığı çözmeyi taklit eder (uaKey: tarayıcının özel anahtarı).
    public static byte[] Decrypt(byte[] body, ECDiffieHellman uaKey, byte[] authSecret)
    {
        var salt = body[..16];
        var idLen = body[20];
        var asPublic = body[21..(21 + idLen)];
        var cipher = body[(21 + idLen)..];

        var uaPublic = ExportPublic(uaKey);
        using var asKey = ImportPublic(asPublic);
        var ecdhSecret = uaKey.DeriveRawSecretAgreement(asKey.PublicKey);
        var keyInfo = Concat(Encoding.ASCII.GetBytes("WebPush: info\0"), uaPublic, asPublic);
        var ikm = HKDF.Expand(HashAlgorithmName.SHA256, HKDF.Extract(HashAlgorithmName.SHA256, ecdhSecret, authSecret), 32, keyInfo);
        var prk = HKDF.Extract(HashAlgorithmName.SHA256, ikm, salt);
        var cek = HKDF.Expand(HashAlgorithmName.SHA256, prk, 16, Encoding.ASCII.GetBytes("Content-Encoding: aes128gcm\0"));
        var nonce = HKDF.Expand(HashAlgorithmName.SHA256, prk, 12, Encoding.ASCII.GetBytes("Content-Encoding: nonce\0"));

        var plain = new byte[cipher.Length - TagSize];
        using (var aes = new AesGcm(cek, TagSize))
            aes.Decrypt(nonce, cipher.AsSpan(0, plain.Length), cipher.AsSpan(plain.Length), plain);
        var end = Array.LastIndexOf(plain, (byte)0x02);
        if (end < 0) throw new CryptographicException("Kayıt sınırlayıcısı yok.");
        return plain[..end];
    }

    // Sıkıştırılmamış nokta: 0x04 | X (32) | Y (32)
    public static byte[] ExportPublic(ECDiffieHellman key)
    {
        var q = key.ExportParameters(false).Q;
        return Concat([0x04], q.X!, q.Y!);
    }

    public static ECDiffieHellman ImportPublic(byte[] point)
    {
        if (point.Length != 65 || point[0] != 0x04) throw new CryptographicException("Geçersiz ortak anahtar.");
        return ECDiffieHellman.Create(new ECParameters
        {
            Curve = ECCurve.NamedCurves.nistP256,
            Q = new ECPoint { X = point[1..33], Y = point[33..65] }
        });
    }

    public static ECDiffieHellman ImportPrivate(byte[] d) =>
        ECDiffieHellman.Create(new ECParameters { Curve = ECCurve.NamedCurves.nistP256, D = d });

    private static byte[] Concat(params byte[][] parts)
    {
        var result = new byte[parts.Sum(p => p.Length)];
        var offset = 0;
        foreach (var p in parts) { p.CopyTo(result, offset); offset += p.Length; }
        return result;
    }
}

// Web Push'ta anahtarlar ve gövdeler base64url (dolgusuz) ile taşınır.
public static class Base64Url
{
    public static string Encode(ReadOnlySpan<byte> data) =>
        Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static byte[] Decode(string text)
    {
        var s = text.Trim().Replace('-', '+').Replace('_', '/');
        s = s.PadRight(s.Length + (4 - s.Length % 4) % 4, '=');
        return Convert.FromBase64String(s);
    }
}
