using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace PlanToBee.API.Infrastructure;

// Kişisel verinin (e-posta adresleri, kullanıcı adı) veritabanında korunması. Veritabanı ya da yedeği sızsa bile
// adresler okunamaz; okumak için ortam değişkenindeki anahtar da gerekir (PersonalData:Key, PersonalData__Key).
//
// - Okunması gereken alanlar (Email, UserName) AES-256-GCM ile, her yazımda rastgele nonce ile şifrelenir:
//   "e1:" + base64(nonce | tag | şifreli metin).
// - Aranan alanlar (NormalizedEmail, NormalizedUserName) anahtarlı özetle (HMAC-SHA256) saklanır:
//   "h1:" + base64(hmac). Aynı adres her zaman aynı özeti verir; eşitlik sorguları ve benzersiz indeksler çalışır.
//   Anahtar olmadan özetten adres tahmin edilemez (düz SHA-256'nın aksine sözlük saldırısına açık değildir).
//
// Dönüşüm EF Core değer dönüştürücüleriyle yapılır (AppDbContext); uygulama kodu açık metinle çalışır.
// Önek taşıyan değerler yeniden dönüştürülmez (idempotent). Öneksiz değerler eski (şifrelenmemiş) kayıtlardır;
// okunurken olduğu gibi döner, açılışta PersonalDataBackfill tarafından şifrelenir.
public sealed class PersonalDataProtector
{
    private const string EncryptedPrefix = "e1:";
    private const string IndexPrefix = "h1:";
    private const int NonceSize = 12;
    private const int TagSize = 16;

    private readonly byte[] _encryptionKey;
    private readonly byte[] _indexKey;

    // Hangi anahtarın kullanıldığını ayırt etmek için (anahtarın kendisini ele vermez).
    public string KeyId { get; }

    public PersonalDataProtector(string secret)
    {
        var ikm = Encoding.UTF8.GetBytes(secret);
        _encryptionKey = HKDF.DeriveKey(HashAlgorithmName.SHA256, ikm, 32, info: Encoding.UTF8.GetBytes("PlanToBee personal data encryption v1"));
        _indexKey = HKDF.DeriveKey(HashAlgorithmName.SHA256, ikm, 32, info: Encoding.UTF8.GetBytes("PlanToBee personal data index v1"));
        KeyId = Convert.ToHexStringLower(SHA256.HashData(_encryptionKey))[..12];
    }

    public static bool IsEncrypted(string? value) => value != null && value.StartsWith(EncryptedPrefix, StringComparison.Ordinal);
    public static bool IsIndexed(string? value) => value != null && value.StartsWith(IndexPrefix, StringComparison.Ordinal);

    public string? Encrypt(string? plain)
    {
        if (plain == null || IsEncrypted(plain)) return plain;
        var data = Encoding.UTF8.GetBytes(plain);
        var output = new byte[NonceSize + TagSize + data.Length];
        var nonce = output.AsSpan(0, NonceSize);
        RandomNumberGenerator.Fill(nonce);
        using (var aes = new AesGcm(_encryptionKey, TagSize))
            aes.Encrypt(nonce, data, output.AsSpan(NonceSize + TagSize), output.AsSpan(NonceSize, TagSize));
        return EncryptedPrefix + Convert.ToBase64String(output);
    }

    public string? Decrypt(string? stored)
    {
        if (stored == null || !IsEncrypted(stored)) return stored;
        var input = Convert.FromBase64String(stored[EncryptedPrefix.Length..]);
        if (input.Length < NonceSize + TagSize)
            throw new CryptographicException("Şifreli kişisel veri bozuk.");
        var plain = new byte[input.Length - NonceSize - TagSize];
        try
        {
            using var aes = new AesGcm(_encryptionKey, TagSize);
            aes.Decrypt(input.AsSpan(0, NonceSize), input.AsSpan(NonceSize + TagSize), input.AsSpan(NonceSize, TagSize), plain);
        }
        catch (AuthenticationTagMismatchException)
        {
            throw new CryptographicException(
                "Şifreli e-posta adresi çözülemedi: PersonalData__Key, veriyi şifreleyen anahtardan farklı. " +
                "Anahtar değiştirilmiş ya da yanlış girilmiş olabilir (docs/DEPLOY.md).");
        }
        return Encoding.UTF8.GetString(plain);
    }

    // Aranan alanlar için anahtarlı özet. Değer zaten normalize edilmiş olmalıdır (Identity büyük harfe çevirir).
    public string? Index(string? normalized)
    {
        if (normalized == null || IsIndexed(normalized)) return normalized;
        return IndexPrefix + Convert.ToBase64String(HMACSHA256.HashData(_indexKey, Encoding.UTF8.GetBytes(normalized)));
    }

    // İki normalize değer (özetlenmiş ya da açık) aynı adresi mi gösteriyor?
    public bool SameIndex(string? a, string? b) => a != null && b != null && Index(a) == Index(b);

    public ValueConverter<string?, string?> EncryptedConverter() =>
        new(v => Encrypt(v), v => Decrypt(v));

    // Özet geri çevrilemez: okunan değer özetin kendisidir. Uygulama bu alanları yalnızca karşılaştırmada kullanır.
    public ValueConverter<string?, string?> IndexConverter() =>
        new(v => Index(v), v => v);

    // PersonalData:Key ayarlı değilse geliştirmede Jwt:Key'den türetilir (farklı amaç etiketiyle).
    // Üretimde ayrı anahtar zorunludur (StartupValidation): bu anahtar kaybolursa e-posta adresleri kurtarılamaz.
    public static string? ResolveSecret(IConfiguration config) =>
        config["PersonalData:Key"] is { Length: > 0 } key ? key
        : config["Jwt:Key"] is { Length: > 0 } jwt ? "derived-from-jwt:" + jwt
        : null;
}
