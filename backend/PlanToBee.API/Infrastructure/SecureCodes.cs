using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;

namespace PlanToBee.API.Infrastructure;

public static class SecureCodes
{
    // Tahmin edilemez, URL güvenli davet belirteci (256 bit)
    public static string NewToken() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

    public static string NewSixDigitCode() => RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

    public static string NewSalt() => Convert.ToHexString(RandomNumberGenerator.GetBytes(16));

    public static string Sha256(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    public static bool FixedTimeEquals(string a, string b) =>
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));

    // Identity belirteçleri (+,/,=) içerir; e-posta linkinde güvenli taşınması için Base64Url.
    public static string EncodeForUrl(string token) => WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

    public static string? DecodeFromUrl(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        try { return Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(token)); }
        catch (FormatException) { return null; }
    }
}
