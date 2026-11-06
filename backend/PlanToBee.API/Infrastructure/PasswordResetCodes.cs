using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace PlanToBee.API.Infrastructure;

// "Şifremi unuttum" e-postasındaki 6 haneli kod. Kod ekranda girilir ve yeni şifreyle birlikte gönderilir;
// doğruysa şifre değişir, hesap kilidi açılır (kalıcı giriş kilidi yalnızca bu yolla ya da e-postadaki
// bağlantıyla açılır).
// - Kodun kendisi saklanmaz, yalnızca SHA-256 özeti saklanır.
// - Kod 15 dakika geçerlidir, tek kullanımlıktır ve 5 hatalı denemede geçersiz olur.
// - Kullanıcı başına tek aktif kod vardır (yenisi eskisini geçersiz kılar).
// - Kod verildiği andaki güvenlik damgasına bağlıdır: arada şifre değişirse kod geçersizdir.
// - Bellek içi tutulur (LoginChallenges gibi). Sunucu yeniden başlarsa kod kaybolur; e-postadaki bağlantı
//   çalışmaya devam eder ya da kullanıcı yeni kod ister.
public class PasswordResetCodes
{
    public const int CodeLength = 6;
    public const int MaxAttempts = 5;
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(15);

    private sealed class Entry(string securityStamp, string codeHash)
    {
        public string SecurityStamp { get; } = securityStamp;
        public string CodeHash { get; } = codeHash;
        public DateTime ExpiresAt { get; } = DateTime.UtcNow + Lifetime;
        public int Attempts { get; set; }
    }

    private readonly ConcurrentDictionary<string, Entry> _entries = new();

    // Kullanıcıya yeni kod üretir (varsa eskisi geçersiz olur). Döner: e-postaya gidecek kod.
    public string Create(string userId, string securityStamp)
    {
        Sweep();
        var code = RandomNumberGenerator.GetInt32(0, (int)Math.Pow(10, CodeLength)).ToString().PadLeft(CodeLength, '0');
        _entries[userId] = new Entry(securityStamp, Hash(userId, code));
        return code;
    }

    // Kodu doğrular. Doğruysa kod tüketilir ve verildiği andaki güvenlik damgası döner (çağıran güncel damgayla
    // karşılaştırır). Yanlışsa null döner; 5. hatalı denemede kod silinir.
    public string? Consume(string userId, string code)
    {
        if (!_entries.TryGetValue(userId, out var e)) return null;
        lock (e)
        {
            if (e.ExpiresAt <= DateTime.UtcNow || e.Attempts >= MaxAttempts)
            {
                _entries.TryRemove(new KeyValuePair<string, Entry>(userId, e));
                return null;
            }
            e.Attempts++;
            if (SecureCodes.FixedTimeEquals(e.CodeHash, Hash(userId, code)))
            {
                _entries.TryRemove(new KeyValuePair<string, Entry>(userId, e));
                return e.SecurityStamp;
            }
            if (e.Attempts >= MaxAttempts) _entries.TryRemove(new KeyValuePair<string, Entry>(userId, e));
            return null;
        }
    }

    public void Remove(string userId) => _entries.TryRemove(userId, out _);

    private static string Hash(string userId, string code) => SecureCodes.Sha256($"reset:{userId}:{code}");

    private void Sweep()
    {
        var now = DateTime.UtcNow;
        foreach (var (key, e) in _entries)
            if (e.ExpiresAt <= now) _entries.TryRemove(new KeyValuePair<string, Entry>(key, e));
    }
}
