using System.Collections.Concurrent;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace PlanToBee.API.Infrastructure;

// Olmayan hesaplara yapılan giriş denemelerinde Identity'nin hesap kilidini taklit eder: aynı sayıda hatalı
// denemeden sonra aynı süre boyunca (gerçek hesapta kalıcı) 429 locked_out döner. Böylece "kilitlendi" cevabı
// hesabın var olduğunu ele vermez. Bellek içidir; tek sunucu örneği için yeterli, yeniden başlatmada sıfırlanır.
// Bellek sınırsız büyümesin diye kilitli kayıt da LockedRetention boyunca hiç denenmezse silinir.
public class MissingAccountLockout(IOptions<IdentityOptions> identity)
{
    private static readonly TimeSpan Retention = TimeSpan.FromDays(1);
    private static readonly TimeSpan LockedRetention = TimeSpan.FromDays(30);
    private const int SweepEvery = 500;

    private readonly ConcurrentDictionary<string, Entry> _entries = new();
    private int _calls;

    private sealed class Entry
    {
        public int Failed;
        public DateTime LockedUntil;
        public DateTime LastSeen;
    }

    // Olmayan hesap için hatalı denemeyi kaydeder. Identity gibi: kilitliyse sayılmaz; sınıra ulaşan deneme
    // kilidi başlatır ve sayaç sıfırlanır. Dönen değer: bu deneme kilitli mi (true → 429).
    public bool RegisterFailure(string normalizedEmail)
    {
        if (Interlocked.Increment(ref _calls) % SweepEvery == 0) Sweep();

        var o = identity.Value.Lockout;
        var now = DateTime.UtcNow;
        var e = _entries.GetOrAdd(normalizedEmail, _ => new Entry());
        lock (e)
        {
            e.LastSeen = now;
            if (e.LockedUntil > now) return true;
            e.Failed++;
            if (e.Failed < o.MaxFailedAccessAttempts) return false;
            e.Failed = 0;
            e.LockedUntil = now + o.DefaultLockoutTimeSpan;
            return true;
        }
    }

    private void Sweep()
    {
        var now = DateTime.UtcNow;
        foreach (var (key, e) in _entries)
        {
            lock (e)
            {
                var idleLimit = e.LockedUntil > now ? LockedRetention : Retention;
                if (e.LastSeen < now - idleLimit)
                    _entries.TryRemove(new KeyValuePair<string, Entry>(key, e));
            }
        }
    }
}
