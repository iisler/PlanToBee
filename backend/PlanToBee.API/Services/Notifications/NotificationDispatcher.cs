using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PlanToBee.API.Data;
using PlanToBee.API.Infrastructure;
using PlanToBee.API.Models;

namespace PlanToBee.API.Services.Notifications;

public class WebPushOptions
{
    public const string Section = "WebPush";

    // VAPID anahtarının türetildiği gizli değer (Render: WebPush__Key, otomatik üretilir). Boşsa bildirimler kapalı.
    public string? Key { get; set; }
    // Push servislerine verilen iletişim adresi (RFC 8292). Boşsa Email:From kullanılır.
    public string? Subject { get; set; }
    // Aynı kişinin art arda girişleri bu kadar sessizlikten sonra tek bildirim olarak gider...
    public int BatchSeconds { get; set; } = 60;
    // ...ama ilk girişin üzerinden en fazla bu kadar geçince beklemeden gider.
    public int MaxBatchSeconds { get; set; } = 120;
    // Yalnızca geliştirme/test: izin listesine eklenen sahte push servisi adresleri (örn. "localhost").
    public List<string> TestEndpointHosts { get; set; } = [];

    public bool Enabled => !string.IsNullOrWhiteSpace(Key);
}

// Kuyruğa yeni olay yazılınca dağıtıcıyı uyandırır.
public class NotificationSignal
{
    private readonly SemaphoreSlim _signal = new(0);
    public void Notify() { if (_signal.CurrentCount == 0) _signal.Release(); }
    public Task WaitAsync(TimeSpan timeout, CancellationToken ct) => _signal.WaitAsync(timeout, ct);
}

// Kuyruktaki bildirimleri toplayıp gönderir. Açılışta da çalışır: sunucu uykudayken vadesi gelen (örn. sessiz saat
// sonu) bildirimler uyanınca gider.
public class NotificationDispatcher(IServiceScopeFactory scopes, NotificationSignal signal, IOptions<WebPushOptions> options,
    ILogger<NotificationDispatcher> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.Enabled) return;
        var interval = TimeSpan.FromSeconds(Math.Clamp(options.Value.BatchSeconds / 3.0, 1, 15));
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await FlushAsync(DateTime.UtcNow, stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException) { logger.LogError(ex, "Bildirim kuyruğu işlenemedi"); }
            try { await signal.WaitAsync(interval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    public async Task FlushAsync(DateTime now, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var sender = scope.ServiceProvider.GetRequiredService<PushSender>();
        var app = scope.ServiceProvider.GetRequiredService<IOptions<AppOptions>>().Value;
        var o = options.Value;

        var pending = await db.PendingNotifications.ToListAsync(ct);
        if (pending.Count == 0) return;

        var messages = new List<(int Recipient, PushMessage Message, List<PendingNotification> Rows)>();
        // Anında gidenler: alıcı + kaydı giren kişi başına toplanır.
        foreach (var g in pending.Where(p => p.HoldUntil == null).GroupBy(p => (p.RecipientMemberId, p.ActorMemberId)))
        {
            var last = g.Max(p => p.CreatedAt);
            var first = g.Min(p => p.CreatedAt);
            if (now - last < TimeSpan.FromSeconds(o.BatchSeconds) && now - first < TimeSpan.FromSeconds(o.MaxBatchSeconds)) continue;
            messages.Add((g.Key.RecipientMemberId, Compose(g.ToList(), app, held: false), g.ToList()));
        }
        // Sessiz saatte bekleyenler: süresi dolunca alıcı başına tek özet.
        foreach (var g in pending.Where(p => p.HoldUntil != null && p.HoldUntil <= now).GroupBy(p => p.RecipientMemberId))
            messages.Add((g.Key, Compose(g.ToList(), app, held: true), g.ToList()));
        if (messages.Count == 0) return;

        // Önce kuyruktan sil (aynı bildirim iki kez gitmesin), sonra gönder.
        db.PendingNotifications.RemoveRange(messages.SelectMany(m => m.Rows));
        await db.SaveChangesAsync(ct);
        foreach (var (recipient, message, _) in messages)
            await sender.SendToMemberAsync(recipient, message, ct);
    }

    // Tek kayıt: kaydın kendi metni. Birden çok: türlere göre sayılar. Sessiz saat özeti: kişi başına sayılar.
    public static PushMessage Compose(List<PendingNotification> rows, AppOptions app, bool held)
    {
        var date = rows.Min(r => r.Date);
        var url = app.Link("/", ("date", date.ToString("yyyy-MM-dd")));
        if (rows.Count == 1) return new PushMessage(rows[0].Title, rows[0].Body, url);

        if (!held || rows.Select(r => r.ActorMemberId).Distinct().Count() == 1)
        {
            var name = rows[^1].ActorName;
            var allAdds = rows.All(r => r.Category is NotificationCategory.StudyAdded or NotificationCategory.ActivityAdded);
            var title = allAdds ? $"{name} {rows.Count} kayıt ekledi" : $"{name}: {rows.Count} güncelleme";
            return new PushMessage(title, Counts(rows), url);
        }
        var body = string.Join(" · ", rows.GroupBy(r => r.ActorMemberId).Select(g => $"{g.Last().ActorName}: {Counts(g.ToList())}"));
        return new PushMessage($"Sessiz saatlerde {rows.Count} güncelleme", body, url);
    }

    private static string Counts(List<PendingNotification> rows)
    {
        var parts = new List<string>();
        void Add(NotificationCategory c, string text) { var n = rows.Count(r => r.Category == c); if (n > 0) parts.Add($"{n} {text}"); }
        Add(NotificationCategory.StudyAdded, "ders");
        Add(NotificationCategory.ActivityAdded, "aktivite");
        Add(NotificationCategory.StudyDone, "ders bitti");
        Add(NotificationCategory.Changed, "değişiklik");
        Add(NotificationCategory.Deleted, "silme");
        return string.Join(", ", parts);
    }
}

public record PushMessage(string Title, string Body, string Url)
{
    public byte[] ToJson() => JsonSerializer.SerializeToUtf8Bytes(new { title = Title, body = Body, url = Url });
}
