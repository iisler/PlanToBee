using System.Collections.Concurrent;

namespace PlanToBee.API.Infrastructure;

// E-posta gönderimleri için basit, bellek içi kayan pencere sınırlayıcı.
// Tek sunucu örneği için yeterli; birden fazla örnekte paylaşılan bir depo (ör. Redis) gerekir.
public class SendThrottle
{
    // Kullanılan en uzun pencere (aile başına günlük davet sınırı). Bundan eski kayıtlar hiçbir sınırı etkilemez.
    private static readonly TimeSpan MaxWindow = TimeSpan.FromDays(1);
    private const int SweepEvery = 500;

    private readonly ConcurrentDictionary<string, Queue<DateTime>> _hits = new();
    private int _calls;

    // Anahtar için pencere içindeki gönderim sayısı max'ı aşmıyorsa kaydeder ve true döner.
    public bool TryAcquire(string key, TimeSpan window, int max, TimeSpan? minInterval = null)
    {
        if (Interlocked.Increment(ref _calls) % SweepEvery == 0) Sweep();

        var now = DateTime.UtcNow;
        var q = _hits.GetOrAdd(key, _ => new Queue<DateTime>());
        lock (q)
        {
            while (q.Count > 0 && now - q.Peek() > window) q.Dequeue();
            if (q.Count >= max) return false;
            if (minInterval != null && q.Count > 0 && now - q.Last() < minInterval) return false;
            q.Enqueue(now);
            return true;
        }
    }

    // Son kaydı en uzun pencereden eski olan anahtarları siler; aksi halde her kullanıcı/aile için açılan
    // kuyruklar süreç yaşadıkça bellekte birikirdi.
    private void Sweep()
    {
        var cutoff = DateTime.UtcNow - MaxWindow;
        foreach (var (key, q) in _hits)
        {
            lock (q)
            {
                if (q.Count == 0 || q.Last() < cutoff)
                    _hits.TryRemove(new KeyValuePair<string, Queue<DateTime>>(key, q));
            }
        }
    }
}
