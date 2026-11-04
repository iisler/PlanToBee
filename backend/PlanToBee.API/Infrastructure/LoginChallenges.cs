using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace PlanToBee.API.Infrastructure;

// Girişte e-postayla gönderilen tek kullanımlık 6 haneli kod (iki adımlı doğrulama).
// Şifre doğru girilince bir "challenge" açılır; kod e-postaya gider, oturum ancak kod doğrulanınca açılır.
// - Kodun kendisi saklanmaz, yalnızca SHA-256 özeti saklanır.
// - Kod 10 dakika geçerlidir, tek kullanımlıktır ve 5 hatalı denemede challenge iptal edilir.
// - Kullanıcı başına tek aktif challenge vardır (yenisi eskisini iptal eder).
// - Bellek içi tutulur (SendThrottle gibi tek sunucu örneği için yeterli). Sunucu yeniden başlarsa bekleyen
//   challenge'lar kaybolur; kullanıcı yeniden giriş yapar. Birden fazla örnekte paylaşılan depo gerekir.
public class LoginChallenges
{
    public const int CodeLength = 6;
    public const int MaxAttempts = 5;
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);

    public enum VerifyStatus { Ok, Wrong, Expired }

    private sealed class Entry(string userId, string securityStamp)
    {
        public string UserId { get; } = userId;
        public string SecurityStamp { get; } = securityStamp;
        public string CodeHash { get; set; } = "";
        public DateTime ExpiresAt { get; set; }
        public int Attempts { get; set; }
    }

    private readonly ConcurrentDictionary<string, Entry> _entries = new();

    // Yeni challenge açar; aynı kullanıcının eskisi iptal edilir. Döner: challenge kimliği ve e-postaya gidecek kod.
    public (string Id, string Code) Create(string userId, string securityStamp)
    {
        Sweep();
        foreach (var (key, e) in _entries)
            if (e.UserId == userId) _entries.TryRemove(key, out _);

        var id = SecureCodes.NewToken();
        var entry = new Entry(userId, securityStamp);
        var code = Reissue(id, entry);
        _entries[id] = entry;
        return (id, code);
    }

    // Challenge'ın sahibi (süresi dolmamışsa); "tekrar gönder" sınırı kullanıcıya göre uygulanır.
    public string? UserOf(string id) =>
        _entries.TryGetValue(id, out var e) && e.ExpiresAt > DateTime.UtcNow ? e.UserId : null;

    // Aynı challenge için yeni kod üretir (eski kod geçersiz olur, deneme sayısı sıfırlanır).
    public string? Resend(string id)
    {
        if (!_entries.TryGetValue(id, out var e)) return null;
        lock (e)
        {
            if (e.ExpiresAt <= DateTime.UtcNow) return null;
            return Reissue(id, e);
        }
    }

    public void Remove(string id) => _entries.TryRemove(id, out _);

    // Kodu doğrular. Doğruysa challenge tüketilir (tek kullanım). Süresi dolmuş, bilinmeyen ya da deneme hakkı
    // biten challenge Expired döner.
    public (VerifyStatus Status, string? UserId, string? SecurityStamp) Verify(string id, string code)
    {
        if (!_entries.TryGetValue(id, out var e)) return (VerifyStatus.Expired, null, null);
        lock (e)
        {
            if (e.ExpiresAt <= DateTime.UtcNow || e.Attempts >= MaxAttempts)
            {
                _entries.TryRemove(id, out _);
                return (VerifyStatus.Expired, null, null);
            }
            e.Attempts++;
            if (SecureCodes.FixedTimeEquals(e.CodeHash, Hash(id, code)))
            {
                _entries.TryRemove(id, out _);
                return (VerifyStatus.Ok, e.UserId, e.SecurityStamp);
            }
            if (e.Attempts >= MaxAttempts)
            {
                _entries.TryRemove(id, out _);
                return (VerifyStatus.Expired, null, null);
            }
            return (VerifyStatus.Wrong, null, null);
        }
    }

    // Kalan deneme hakkı (yanlış koddan sonra kullanıcıya gösterilir).
    public int AttemptsLeft(string id) =>
        _entries.TryGetValue(id, out var e) ? Math.Max(0, MaxAttempts - e.Attempts) : 0;

    private static string Reissue(string id, Entry e)
    {
        var code = RandomNumberGenerator.GetInt32(0, (int)Math.Pow(10, CodeLength)).ToString().PadLeft(CodeLength, '0');
        e.CodeHash = Hash(id, code);
        e.ExpiresAt = DateTime.UtcNow + Lifetime;
        e.Attempts = 0;
        return code;
    }

    private static string Hash(string id, string code) => SecureCodes.Sha256($"{id}:{code}");

    private void Sweep()
    {
        var now = DateTime.UtcNow;
        foreach (var (key, e) in _entries)
            if (e.ExpiresAt <= now) _entries.TryRemove(key, out _);
    }
}
