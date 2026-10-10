using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using PlanToBee.API.Data;
using PlanToBee.API.DTOs;
using PlanToBee.API.Infrastructure;
using PlanToBee.API.Models;
using PlanToBee.API.Services;
using PlanToBee.API.Services.Notifications;

namespace PlanToBee.API.Controllers;

// Ailenin ortak gün ve hafta planı. Ailedeki herkes kayıt ekleyebilir; bir kaydı ebeveynler
// ve kaydı ekleyen kişi düzenleyip silebilir (MemberContext.CanEdit).
[ApiController]
[Route("api/days")]
[Authorize]
[RequireVerifiedEmail]
[EnableRateLimiting(RateLimitPolicies.Api)]
public class DaysController(AppDbContext db, MemberContext members, NotificationService notifications) : ControllerBase
{
    private static readonly string[] ValidStatuses = ["todo", "inprogress", "done"];

    [HttpGet("{date}")]
    public async Task<IActionResult> GetDay(string date)
    {
        if (!PlanText.TryParseDate(date, out var d)) return InvalidDate();
        var me = await members.GetCurrentAsync();
        if (me == null) return await members.MissingAsync();

        // Okuma kayıt oluşturmaz; gün yoksa boş döner.
        var days = await LoadDaysAsync(me.FamilyId, d, d);
        var audit = await LoadAuditAsync(me, days);
        return Ok(ToDayDto(d, days.FirstOrDefault(), me, audit));
    }

    // Hafta özeti (Gün sekmesindeki hafta şeridi): her gün için toplamlar. Toplamlar veritabanında hesaplanır,
    // kayıtların kendisi yüklenmez.
    [HttpGet("week/{monday}")]
    public async Task<IActionResult> GetWeek(string monday)
    {
        if (!PlanText.TryParseDate(monday, out var start)) return InvalidDate();
        var me = await members.GetCurrentAsync();
        if (me == null) return await members.MissingAsync();

        var end = start.AddDays(6);
        var totals = await db.Days
            .AsNoTracking()
            .Where(d => d.FamilyId == me.FamilyId && d.Date >= start && d.Date <= end)
            .Select(d => new
            {
                d.Date,
                StudyMinutes = d.StudyEntries.Sum(e => (long)e.Minutes),
                EntryCount = d.StudyEntries.Count,
                TrainingCount = d.Events.Count(e => e.Kind == EventKind.Training),
                TrainingMinutes = d.Events.Where(e => e.Kind == EventKind.Training).Sum(e => (long?)e.Minutes) ?? 0,
                EventCount = d.Events.Count(e => e.Kind != EventKind.Training)
            })
            .ToDictionaryAsync(x => x.Date);

        var result = Enumerable.Range(0, 7).Select(i =>
        {
            var date = start.AddDays(i);
            totals.TryGetValue(date, out var t);
            return new WeekSummaryDto(
                PlanText.Format(date),
                (int)Math.Min(int.MaxValue, t?.StudyMinutes ?? 0),
                t?.EntryCount ?? 0,
                t?.TrainingCount > 0,
                t?.TrainingCount ?? 0,
                (int)Math.Min(int.MaxValue, t?.TrainingMinutes ?? 0),
                t?.EventCount ?? 0);
        }).ToList();
        return Ok(new WeekDto(result));
    }

    // Hafta Planı ekranı için haftanın 7 gününün tüm kayıtları tek istekte.
    // Her eleman GET /api/days/{date} cevabıyla aynı biçimdedir (kayıtsız gün boş listelerle döner).
    [HttpGet("week/{monday}/details")]
    public async Task<IActionResult> GetWeekDetails(string monday)
    {
        if (!PlanText.TryParseDate(monday, out var start)) return InvalidDate();
        var me = await members.GetCurrentAsync();
        if (me == null) return await members.MissingAsync();

        var end = start.AddDays(6);
        var days = await LoadDaysAsync(me.FamilyId, start, end);
        var audit = await LoadAuditAsync(me, days);
        var byDate = days.ToDictionary(x => x.Date);
        var result = Enumerable.Range(0, 7)
            .Select(i => start.AddDays(i))
            .Select(date => ToDayDto(date, byDate.GetValueOrDefault(date), me, audit))
            .ToList();
        return Ok(new WeekDetailsDto(result));
    }

    // ---------- Ders kayıtları ----------

    [HttpPost("{date}/entries")]
    public async Task<IActionResult> AddEntry(string date, AddStudyEntryDto dto)
    {
        if (!PlanText.TryParseDate(date, out var d)) return InvalidDate();
        if (string.IsNullOrWhiteSpace(dto.Subject)) return Err.BadRequest("validation", "Ders seçin.");
        var me = await members.GetCurrentAsync();
        if (me == null) return await members.MissingAsync();

        var dayId = await GetOrCreateDayId(me.FamilyId, d);
        var entry = new StudyEntry { DayId = dayId, Subject = dto.Subject.Trim(), Topic = dto.Topic?.Trim() ?? "", Minutes = dto.Minutes, Status = "todo" };
        StampCreated(entry, me);
        db.StudyEntries.Add(entry);
        await db.SaveChangesAsync();
        await notifications.EnqueueAsync(me, NotificationCategory.StudyAdded, $"{me.DisplayName} ders ekledi",
            $"{NotificationText.Study(entry)} — {NotificationText.Date(d)}", d);
        return Ok(await MapOne(entry, me));
    }

    [HttpPut("{date}/entries/{id:int}")]
    public async Task<IActionResult> UpdateEntry(string date, int id, UpdateStudyEntryDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Subject)) return Err.BadRequest("validation", "Ders seçin.");
        if (dto.Status != null && !ValidStatuses.Contains(dto.Status)) return Err.BadRequest("validation", "Geçersiz durum.");
        var entry = await db.StudyEntries.Include(e => e.Day).FirstOrDefaultAsync(e => e.Id == id);
        var (me, error) = await AuthorizeEntry(date, entry);
        if (error != null) return error;

        var wasDone = entry!.Status == "done";
        entry.Subject = dto.Subject.Trim();
        entry.Topic = dto.Topic?.Trim() ?? "";
        entry.Minutes = dto.Minutes;
        if (dto.Status != null) entry.Status = dto.Status;
        StampUpdated(entry, me!);
        await db.SaveChangesAsync();
        await NotifyStudyChange(me!, entry, wasDone, changed: true);
        return Ok(await MapOne(entry, me!));
    }

    [HttpPatch("{date}/entries/{id:int}/status")]
    public async Task<IActionResult> PatchStatus(string date, int id, PatchStatusDto dto)
    {
        if (!ValidStatuses.Contains(dto.Status)) return Err.BadRequest("validation", "Geçersiz durum.");
        var entry = await db.StudyEntries.Include(e => e.Day).FirstOrDefaultAsync(e => e.Id == id);
        // Durumu ailedeki herkes değiştirebilir: ebeveyn planlar, çocuk çalışıp "Tamamlandı" işaretler.
        // Adı, süreyi değiştirmek ve silmek yine yalnızca ebeveyne ve kaydı ekleyene açıktır (UpdateEntry, DeleteEntry).
        var (me, error) = await AuthorizeEntry(date, entry, requireEdit: false);
        if (error != null) return error;

        var wasDone = entry!.Status == "done";
        entry.Status = dto.Status; // izde son güncelleyen olarak durumu değiştiren görünür
        StampUpdated(entry, me!);
        await db.SaveChangesAsync();
        await NotifyStudyChange(me!, entry, wasDone, changed: false);
        return Ok(await MapOne(entry, me!));
    }

    [HttpDelete("{date}/entries/{id:int}")]
    public async Task<IActionResult> DeleteEntry(string date, int id)
    {
        var entry = await db.StudyEntries.Include(e => e.Day).FirstOrDefaultAsync(e => e.Id == id);
        var (me, error) = await AuthorizeEntry(date, entry);
        if (error != null) return error;
        db.StudyEntries.Remove(entry!);
        await db.SaveChangesAsync();
        await notifications.EnqueueAsync(me!, NotificationCategory.Deleted, $"{me!.DisplayName} bir dersi sildi",
            $"{NotificationText.Study(entry!)} — {NotificationText.Date(entry!.Day!.Date)}", entry.Day.Date);
        return NoContent();
    }

    // ---------- Etkinlikler ----------

    [HttpPost("{date}/events")]
    public async Task<IActionResult> AddEvent(string date, AddEventDto dto)
    {
        if (!PlanText.TryParseDate(date, out var d)) return InvalidDate();
        var kind = dto.Kind ?? EventKind.Event;
        if (!Enum.IsDefined(kind)) return Err.BadRequest("validation", "Geçersiz kayıt türü.");
        var ev = new Event { Kind = kind };
        var error = ApplyEvent(ev, dto.Title, dto.Time, dto.Note, dto.TrainingType, dto.Minutes);
        if (error != null) return error;
        var me = await members.GetCurrentAsync();
        if (me == null) return await members.MissingAsync();

        ev.DayId = await GetOrCreateDayId(me.FamilyId, d);
        StampCreated(ev, me);
        db.Events.Add(ev);
        await db.SaveChangesAsync();
        await notifications.EnqueueAsync(me, NotificationCategory.ActivityAdded, $"{me.DisplayName} aktivite ekledi",
            $"{NotificationText.Activity(ev)} — {NotificationText.Date(d)}", d);
        return Ok(await MapOne(ev, me));
    }

    // Kaydın türü değiştirilemez; yanlış türde girilen kayıt silinip yeniden eklenir.
    [HttpPut("{date}/events/{id:int}")]
    public async Task<IActionResult> UpdateEvent(string date, int id, UpdateEventDto dto)
    {
        var ev = await db.Events.Include(e => e.Day).FirstOrDefaultAsync(e => e.Id == id);
        var (me, authError) = await AuthorizeEntry(date, ev);
        if (authError != null) return authError;

        var error = ApplyEvent(ev!, dto.Title, dto.Time, dto.Note, dto.TrainingType, dto.Minutes);
        if (error != null) return error;
        StampUpdated(ev!, me!);
        await db.SaveChangesAsync();
        await notifications.EnqueueAsync(me!, NotificationCategory.Changed, $"{me!.DisplayName} bir aktiviteyi değiştirdi",
            $"{NotificationText.Activity(ev!)} — {NotificationText.Date(ev!.Day!.Date)}", ev.Day.Date);
        return Ok(await MapOne(ev!, me!));
    }

    [HttpDelete("{date}/events/{id:int}")]
    public async Task<IActionResult> DeleteEvent(string date, int id)
    {
        var ev = await db.Events.Include(e => e.Day).FirstOrDefaultAsync(e => e.Id == id);
        var (me, error) = await AuthorizeEntry(date, ev);
        if (error != null) return error;
        db.Events.Remove(ev!);
        await db.SaveChangesAsync();
        await notifications.EnqueueAsync(me!, NotificationCategory.Deleted, $"{me!.DisplayName} bir aktiviteyi sildi",
            $"{NotificationText.Activity(ev!)} — {NotificationText.Date(ev!.Day!.Date)}", ev.Day.Date);
        return NoContent();
    }

    // ---------- Yardımcılar ----------

    // Ders Tamam'a geçtiyse "bitirdi" bildirimi; değilse (düzenleme formundan) değişiklik bildirimi.
    // Durum rozetiyle Yapılacak/Devam arasında geçiş bildirim üretmez.
    private Task NotifyStudyChange(FamilyMember me, StudyEntry entry, bool wasDone, bool changed)
    {
        var date = entry.Day!.Date;
        var body = $"{NotificationText.Study(entry)} — {NotificationText.Date(date)}";
        if (!wasDone && entry.Status == "done")
            return notifications.EnqueueAsync(me, NotificationCategory.StudyDone,
                $"{me.DisplayName} {NotificationText.Accusative(entry.Subject)} bitirdi ✅", body, date);
        return changed
            ? notifications.EnqueueAsync(me, NotificationCategory.Changed, $"{me.DisplayName} bir dersi değiştirdi", body, date)
            : Task.CompletedTask;
    }

    // Kayıt yoksa, başka ailedeyse ya da rotadaki tarihte değilse 404 (varlığı belli edilmez);
    // görülebiliyor ama istek sahibi düzenleyemiyorsa 403. requireEdit: false yalnızca ailede herkese açık işlemler için
    // (ders durumu).
    private async Task<(FamilyMember? Me, IActionResult? Error)> AuthorizeEntry(string date, AuditedEntity? entry, bool requireEdit = true)
    {
        if (!PlanText.TryParseDate(date, out var d)) return (null, InvalidDate());
        var me = await members.GetCurrentAsync();
        if (me == null) return (null, await members.MissingAsync());
        var day = entry switch
        {
            StudyEntry s => s.Day,
            Event e => e.Day,
            _ => null
        };
        if (entry == null || day == null || day.FamilyId != me.FamilyId || day.Date != d) return (null, Err.NotFound());
        if (requireEdit && !MemberContext.CanEdit(me, entry)) return (null, Err.ReadOnly());
        return (me, null);
    }

    // Türüne göre alanları doğrular ve kayda yazar. Her aktivitenin adı olur; yalnızca eski antrenman kayıtları ad
    // yerine TrainingType ile gelebilir. Süre yalnızca sporda tutulur. Saat boş ya da SS:dd olmalı; eski kayıtlardaki
    // serbest metin saat, değiştirilmeden geri gönderildiyse kabul edilir.
    private static ObjectResult? ApplyEvent(Event ev, string? title, string? time, string? note, string? trainingType, int? minutes)
    {
        var t = time?.Trim() ?? "";
        if (t.Length > 0 && !PlanText.IsTime(t) && t != ev.Time)
            return Err.BadRequest("validation", "Saat SS:dd biçiminde olmalı (örn. 17:30).");
        var name = title?.Trim() ?? "";
        if (ev.Kind == EventKind.Training)
        {
            var type = trainingType?.Trim() ?? "";
            if (name.Length == 0 && type.Length == 0) return Err.BadRequest("validation", "Aktivite adını yazın.");
            // Süre isteğe bağlı; verilirse 1-1440 dakika.
            if (minutes is not null and not (>= 1 and <= 1440)) return Err.BadRequest("validation", "Süre 1 ile 1440 dakika arasında olmalı.");
            ev.Title = name;
            ev.TrainingType = type.Length > 0 ? type : null;
            ev.Minutes = minutes;
        }
        else
        {
            if (name.Length == 0) return Err.BadRequest("validation", "Aktivite adını yazın.");
            ev.Title = name;
            ev.TrainingType = null;
            ev.Minutes = null;
        }
        ev.Time = t;
        ev.Note = note?.Trim() ?? "";
        return null;
    }

    // Günün etkinlik listesi: önce saati olanlar saat sırasıyla, sonra saatsizler (ve eski serbest metin saatliler)
    // eklenme sırasıyla.
    private static IEnumerable<Event> InDayOrder(IEnumerable<Event> events) =>
        events.OrderBy(e => PlanText.IsTime(e.Time) ? 0 : 1)
              .ThenBy(e => PlanText.IsTime(e.Time) ? e.Time : "", StringComparer.Ordinal)
              .ThenBy(e => e.Id);

    private static ObjectResult InvalidDate() =>
        Err.BadRequest("invalid_date", "Geçersiz tarih. Tarih yyyy-AA-gg biçiminde olmalı.");

    // Günleri kayıtlarıyla yükler. İki koleksiyon ayrı sorgularla (split query) okunur; tek sorguda
    // birleştirmek ders × etkinlik sayısı kadar satır (kartezyen çarpım) üretirdi.
    private Task<List<Day>> LoadDaysAsync(int familyId, DateOnly from, DateOnly to) =>
        db.Days
            .AsNoTracking()
            .AsSplitQuery()
            .Include(x => x.StudyEntries)
            .Include(x => x.Events)
            .Where(x => x.FamilyId == familyId && x.Date >= from && x.Date <= to)
            .ToListAsync();

    private Task<AuditLookup> LoadAuditAsync(FamilyMember me, List<Day> days) =>
        AuditLookup.LoadAsync(db, me.FamilyId,
            days.SelectMany(x => x.StudyEntries.Cast<AuditedEntity>().Concat(x.Events)), me);

    private static DayDto ToDayDto(DateOnly date, Day? day, FamilyMember me, AuditLookup audit) =>
        day == null
            ? new DayDto(PlanText.Format(date), [], [])
            : new DayDto(
                PlanText.Format(date),
                day.StudyEntries.OrderBy(e => e.Id).Select(e => Map(e, me, audit)).ToList(),
                InDayOrder(day.Events).Select(e => Map(e, me, audit)).ToList());

    private static void StampCreated(AuditedEntity e, FamilyMember by)
    {
        e.CreatedByMemberId = by.Id;
        e.CreatedAt = DateTime.UtcNow;
    }

    private static void StampUpdated(AuditedEntity e, FamilyMember by)
    {
        e.UpdatedByMemberId = by.Id;
        e.UpdatedAt = DateTime.UtcNow;
    }

    private async Task<object> MapOne(AuditedEntity e, FamilyMember me)
    {
        var audit = await AuditLookup.LoadAsync(db, me.FamilyId, [e], me);
        return e switch
        {
            StudyEntry s => Map(s, me, audit),
            Event ev => Map(ev, me, audit),
            _ => throw new ArgumentException(nameof(e))
        };
    }

    private static StudyEntryDto Map(StudyEntry e, FamilyMember me, AuditLookup a) =>
        new(e.Id, e.Subject, e.Topic, e.Minutes, e.Status, MemberContext.CanEdit(me, e), a.Get(e.CreatedByMemberId), e.CreatedAt, a.Get(e.UpdatedByMemberId), e.UpdatedAt, e.IsImported);
    private static EventDto Map(Event e, FamilyMember me, AuditLookup a) =>
        new(e.Id, e.Kind.ToString(), e.Title, e.Time, e.Note, e.TrainingType, e.Minutes, MemberContext.CanEdit(me, e),
            a.Get(e.CreatedByMemberId), e.CreatedAt, a.Get(e.UpdatedByMemberId), e.UpdatedAt, e.IsImported);

    // Aynı gün için eşzamanlı iki yazma isteği gelirse ikisi de gün oluşturmaya çalışır;
    // (FamilyId, Date) benzersiz indeksine takılan istek, diğerinin oluşturduğu günü kullanır.
    private async Task<int> GetOrCreateDayId(int familyId, DateOnly date)
    {
        var id = await FindDayId(familyId, date);
        if (id != null) return id.Value;

        var day = new Day { FamilyId = familyId, Date = date };
        db.Days.Add(day);
        try
        {
            await db.SaveChangesAsync();
            return day.Id;
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            db.Entry(day).State = EntityState.Detached;
            return await FindDayId(familyId, date) ?? throw new InvalidOperationException("Gün oluşturulamadı");
        }
    }

    private Task<int?> FindDayId(int familyId, DateOnly date) =>
        db.Days.Where(d => d.FamilyId == familyId && d.Date == date).Select(d => (int?)d.Id).FirstOrDefaultAsync();
}
