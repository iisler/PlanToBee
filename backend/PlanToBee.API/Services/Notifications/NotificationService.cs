using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PlanToBee.API.Data;
using PlanToBee.API.Models;

namespace PlanToBee.API.Services.Notifications;

// Plan değişikliklerinden bildirim olayı üretir: alıcıları ayarlara göre süzer ve kuyruğa yazar. Gönderimi
// NotificationDispatcher yapar (toplama ve sessiz saatler orada uygulanır).
// Bildirim üretimi hiçbir zaman kayıt isteğini başarısız yapmaz: hata günlüğe yazılır, istek başarılı döner.
public class NotificationService(AppDbContext db, NotificationSignal signal, IOptions<WebPushOptions> options,
    ILogger<NotificationService> logger)
{
    public async Task EnqueueAsync(FamilyMember actor, NotificationCategory category, string title, string body, DateOnly date)
    {
        if (!options.Value.Enabled) return;
        try
        {
            var now = DateTime.UtcNow;
            // Bildirim alabilecek profiller: ailede aboneliği olan, aktif, kaydı giren dışındaki profiller.
            var candidates = await db.PushSubscriptions
                .Where(s => s.FamilyId == actor.FamilyId && s.MemberId != actor.Id && s.Member!.Status == MemberStatus.Active)
                .Select(s => s.MemberId).Distinct().ToListAsync();
            if (candidates.Count == 0) return;

            var prefs = await db.NotificationPreferences.AsNoTracking()
                .Where(p => candidates.Contains(p.MemberId)).ToDictionaryAsync(p => p.MemberId);
            var added = 0;
            foreach (var memberId in candidates)
            {
                var pref = prefs.GetValueOrDefault(memberId) ?? NotificationPreference.Defaults(memberId);
                if (!Allows(pref, category) || pref.MutedMemberIds.Contains(actor.Id)) continue;
                db.PendingNotifications.Add(new PendingNotification
                {
                    FamilyId = actor.FamilyId,
                    RecipientMemberId = memberId,
                    ActorMemberId = actor.Id,
                    ActorName = actor.DisplayName,
                    Category = category,
                    Title = Trim(title, 120),
                    Body = Trim(body, 300),
                    Date = date,
                    CreatedAt = now,
                    HoldUntil = QuietHours.HoldUntil(pref, now)
                });
                added++;
            }
            if (added == 0) return;
            await db.SaveChangesAsync();
            signal.Notify();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Bildirim kuyruğa yazılamadı ({Category})", category);
        }
    }

    public static bool Allows(NotificationPreference p, NotificationCategory c) => c switch
    {
        NotificationCategory.StudyAdded => p.StudyAdded,
        NotificationCategory.ActivityAdded => p.ActivityAdded,
        NotificationCategory.StudyDone => p.StudyDone,
        NotificationCategory.Changed or NotificationCategory.Deleted => p.Changes,
        _ => false
    };

    // Kesme noktası bir emojinin (vekil çift) ortasına denk gelirse yarım karakter kalmaz; aksi halde veritabanı
    // geçersiz UTF-16 metni reddeder ve bildirim kaybolurdu.
    private static string Trim(string s, int max)
    {
        if (s.Length <= max) return s;
        var cut = max - 1;
        if (char.IsHighSurrogate(s[cut - 1])) cut--;
        return s[..cut] + "…";
    }
}

// Sessiz saatler Türkiye saatine göredir (UTC+3; Türkiye 2016'dan beri yaz saati uygulamıyor).
public static class QuietHours
{
    public static readonly TimeSpan Offset = TimeSpan.FromHours(3);

    // Şu an sessiz saatteyse bildirimin bekleyeceği an (UTC), değilse null.
    public static DateTime? HoldUntil(NotificationPreference p, DateTime utcNow)
    {
        if (!p.QuietEnabled || p.QuietStart == p.QuietEnd) return null;
        var local = utcNow + Offset;
        var t = TimeOnly.FromDateTime(local);
        var inQuiet = p.QuietStart < p.QuietEnd
            ? t >= p.QuietStart && t < p.QuietEnd
            : t >= p.QuietStart || t < p.QuietEnd;
        if (!inQuiet) return null;
        var end = local.Date + p.QuietEnd.ToTimeSpan();
        if (end <= local) end = end.AddDays(1);
        return DateTime.SpecifyKind(end - Offset, DateTimeKind.Utc);
    }
}

// Bildirim metinleri (Türkçe). Uygulamadaki ikonlarla aynı.
public static class NotificationText
{
    private static readonly string[] Days = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    private static readonly string[] Months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

    public static string Date(DateOnly d) => $"{Days[(int)d.DayOfWeek]} {d.Day} {Months[d.Month - 1]}";

    public static string Study(StudyEntry e) =>
        "📚 " + string.Join(" · ", new[] { e.Subject, e.Topic, e.Minutes > 0 ? $"{e.Minutes} dk" : "" }.Where(x => x.Length > 0));

    public static string Activity(Event e)
    {
        var (icon, label) = e.Kind switch
        {
            EventKind.Training => ("🏅", "Spor"),
            EventKind.Music => ("🎵", "Müzik"),
            EventKind.Concert => ("🎤", "Konser"),
            EventKind.Meeting => ("👥", "Buluşma"),
            EventKind.Exam => ("📝", "Sınav"),
            _ => ("✦", "Diğer")
        };
        var name = e.Title.Length > 0 ? e.Title : e.Kind == EventKind.Training ? e.TrainingType ?? label : label;
        return $"{icon} {name}" + (e.Time.Length > 0 ? $" · {e.Time}" : "");
    }

    // "Matematik'i", "Kimya'yı", "Türkçe'yi", "Coğrafya'yı" (belirtme hâli eki, ünlü uyumuyla)
    public static string Accusative(string word)
    {
        var w = word.Trim();
        var lastVowel = w.ToLowerInvariant().LastOrDefault(c => "aeıioöuü".Contains(c));
        var suffix = lastVowel switch
        {
            'a' or 'ı' => "ı",
            'e' or 'i' => "i",
            'o' or 'u' => "u",
            'ö' or 'ü' => "ü",
            _ => "i"
        };
        var endsWithVowel = w.Length > 0 && "aeıioöuüAEIİOÖUÜ".Contains(w[^1]);
        return $"{w}'{(endsWithVowel ? "y" : "")}{suffix}";
    }
}
