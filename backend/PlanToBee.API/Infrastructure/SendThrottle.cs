using System.Collections.Concurrent;

namespace PlanToBee.API.Infrastructure;

// E-posta gönderimleri için basit, bellek içi kayan pencere sınırlayıcı.
// Tek sunucu örneği için yeterli; birden fazla örnekte paylaşılan bir depo (ör. Redis) gerekir.
public class SendThrottle
{
    private readonly ConcurrentDictionary<string, Queue<DateTime>> _hits = new();

    // Anahtar için pencere içindeki gönderim sayısı max'ı aşmıyorsa kaydeder ve true döner.
    public bool TryAcquire(string key, TimeSpan window, int max, TimeSpan? minInterval = null)
    {
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
}
