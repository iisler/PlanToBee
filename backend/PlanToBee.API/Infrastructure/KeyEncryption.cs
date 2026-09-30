using System.Security.Cryptography;
using System.Text;
using System.Xml.Linq;
using Microsoft.AspNetCore.DataProtection.XmlEncryption;

namespace PlanToBee.API.Infrastructure;

// Data Protection anahtarları (e-posta doğrulama ve şifre sıfırlama bağlantılarını imzalar) veritabanına
// AES-256-GCM ile şifrelenmiş olarak yazılır. Şifreleme anahtarı veritabanında değil ortam değişkenindedir:
// DataProtection:KeyEncryptionKey (DataProtection__KeyEncryptionKey); yoksa Jwt:Key'den türetilir.
// Böylece veritabanı yedeği ya da sızıntısı tek başına bu anahtarları okumaya yetmez.
public sealed class KeyEncryptionKey
{
    public byte[] Key { get; }
    // Hangi anahtarla şifrelendiğini ayırt etmek için (anahtarın kendisini ele vermez).
    public string Id { get; }

    public KeyEncryptionKey(string secret)
    {
        Key = HKDF.DeriveKey(HashAlgorithmName.SHA256, Encoding.UTF8.GetBytes(secret), 32,
            info: Encoding.UTF8.GetBytes("PlanToBee DataProtection key encryption v1"));
        Id = Convert.ToHexStringLower(SHA256.HashData(Key))[..12];
    }
}

public sealed class AesGcmXmlEncryptor(KeyEncryptionKey kek) : IXmlEncryptor
{
    public EncryptedXmlInfo Encrypt(XElement plaintextElement)
    {
        var plain = Encoding.UTF8.GetBytes(plaintextElement.ToString(SaveOptions.DisableFormatting));
        var nonce = RandomNumberGenerator.GetBytes(AesGcm.NonceByteSizes.MaxSize);
        var tag = new byte[AesGcm.TagByteSizes.MaxSize];
        var cipher = new byte[plain.Length];
        using (var aes = new AesGcm(kek.Key, tag.Length))
            aes.Encrypt(nonce, plain, cipher, tag);
        CryptographicOperations.ZeroMemory(plain);

        var element = new XElement("encryptedKey",
            new XComment(" PlanToBee: AES-256-GCM ile şifrelendi (DataProtection:KeyEncryptionKey) "),
            new XAttribute("kekId", kek.Id),
            new XElement("nonce", Convert.ToBase64String(nonce)),
            new XElement("tag", Convert.ToBase64String(tag)),
            new XElement("value", Convert.ToBase64String(cipher)));
        return new EncryptedXmlInfo(element, typeof(AesGcmXmlDecryptor));
    }
}

// Data Protection bu sınıfı adıyla ve IServiceProvider alan kurucusuyla kendisi oluşturur.
public sealed class AesGcmXmlDecryptor(IServiceProvider services) : IXmlDecryptor
{
    public XElement Decrypt(XElement encryptedElement)
    {
        var kek = services.GetRequiredService<KeyEncryptionKey>();
        var kekId = (string?)encryptedElement.Attribute("kekId");
        if (kekId != null && kekId != kek.Id)
            throw new CryptographicException(
                $"Data Protection anahtarı farklı bir şifreleme anahtarıyla (kekId={kekId}) şifrelenmiş. " +
                "DataProtection__KeyEncryptionKey (ya da yoksa Jwt__Key) değişmiş olabilir.");

        var nonce = Convert.FromBase64String((string)encryptedElement.Element("nonce")!);
        var tag = Convert.FromBase64String((string)encryptedElement.Element("tag")!);
        var cipher = Convert.FromBase64String((string)encryptedElement.Element("value")!);
        var plain = new byte[cipher.Length];
        try
        {
            using (var aes = new AesGcm(kek.Key, tag.Length))
                aes.Decrypt(nonce, cipher, tag, plain);
            return XElement.Parse(Encoding.UTF8.GetString(plain));
        }
        finally
        {
            CryptographicOperations.ZeroMemory(plain);
        }
    }
}
