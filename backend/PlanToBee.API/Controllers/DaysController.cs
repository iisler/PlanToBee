using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
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
        var series = await LoadSeriesAsync(me.FamilyId, d, d);
        var audit = await LoadAuditAsync(me, days, series);
        return Ok(ToDayDto(d, days.FirstOrDefault(), series, me, audit));
    }

    // Hafta özeti (Gün sekmesindeki hafta şeridi): her gün için toplamlar. Günlerin toplamları veritabanında
    // hesaplanır, kayıtların kendisi yüklenmez; tekrarlayan aktiviteler kuraldan sayılır.
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
        // Tekrarlayan aktiviteler normal aktivite gibi sayılır (sporda süre yok). Yalnızca kural alanları okunur.
        var series = await db.EventSeries
            .AsNoTracking()
            .Where(x => x.FamilyId == me.FamilyId && x.StartDate <= end && x.UntilDate >= start)
            .Select(x => new
            {
                x.Kind,
                x.DaysOfWeek,
                x.StartDate,
                x.UntilDate,
                Skipped = x.Exceptions.Where(ex => ex.Date >= start && ex.Date <= end).Select(ex => ex.Date).ToList()
            })
            .ToListAsync();
        var seriesTraining = new Dictionary<DateOnly, int>();
        var seriesOther = new Dictionary<DateOnly, int>();
        foreach (var x in series)
            foreach (var date in SeriesSchedule.Occurrences(x.DaysOfWeek, x.StartDate, x.UntilDate, start, end, x.Skipped)
                         .Where(d => Holidays.Shows(x.Kind, d)))
            {
                var counts = x.Kind == EventKind.Training ? seriesTraining : seriesOther;
                counts[date] = counts.GetValueOrDefault(date) + 1;
            }

        var result = Enumerable.Range(0, 7).Select(i =>
        {
            var date = start.AddDays(i);
            totals.TryGetValue(date, out var t);
            var trainingCount = (t?.TrainingCount ?? 0) + seriesTraining.GetValueOrDefault(date);
            return new WeekSummaryDto(
                PlanText.Format(date),
                (int)Math.Min(int.MaxValue, t?.StudyMinutes ?? 0),
                t?.EntryCount ?? 0,
                trainingCount > 0,
                trainingCount,
                (int)Math.Min(int.MaxValue, t?.TrainingMinutes ?? 0),
                (t?.EventCount ?? 0) + seriesOther.GetValueOrDefault(date),
                HolidaysOn(date));
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
        var series = await LoadSeriesAsync(me.FamilyId, start, end);
        var audit = await LoadAuditAsync(me, days, series);
        var byDate = days.ToDictionary(x => x.Date);
        var result = Enumerable.Range(0, 7)
            .Select(i => start.AddDays(i))
            .Select(date => ToDayDto(date, byDate.GetValueOrDefault(date), series, me, audit))
            .ToList();
        return Ok(new WeekDetailsDto(result));
    }

    // ---------- Ders kayıtları ----------

    [HttpPost("{date}/entries")]
    public async Task<IActionResult> AddEntry(string date, AddStudyEntryDto dto)
    {
        if (!PlanText.TryParseDate(date, out var d)) return InvalidDate();
        if (string.IsNullOrWhiteSpace(dto.Subject)) return Err.BadRequest("validation", "Ders seçin.");
        if (!TryParseStartTime(dto.StartTime ?? "", null, out var start)) return InvalidStartTime();
        var me = await members.GetCurrentAsync();
        if (me == null) return await members.MissingAsync();

        var dayId = await PlanWrites.GetOrCreateDayIdAsync(db, me.FamilyId, d);
        var entry = new StudyEntry { DayId = dayId, Subject = dto.Subject.Trim(), Topic = dto.Topic?.Trim() ?? "", Minutes = dto.Minutes, Status = "todo", StartTime = start };
        PlanWrites.StampCreated(entry, me);
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

        if (!TryParseStartTime(dto.StartTime, entry!.StartTime, out var start)) return InvalidStartTime();

        var wasDone = entry.Status == "done";
        entry.Subject = dto.Subject.Trim();
        entry.Topic = dto.Topic?.Trim() ?? "";
        entry.Minutes = dto.Minutes;
        entry.StartTime = start;
        if (dto.Status != null) entry.Status = dto.Status;
        PlanWrites.StampUpdated(entry, me!);
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
        PlanWrites.StampUpdated(entry, me!);
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
        var error = PlanWrites.ApplyEvent(ev, dto.Title, dto.Time, dto.Note, dto.TrainingType, dto.Minutes, dto.EndTime ?? "");
        if (error != null) return error;
        var me = await members.GetCurrentAsync();
        if (me == null) return await members.MissingAsync();

        ev.DayId = await PlanWrites.GetOrCreateDayIdAsync(db, me.FamilyId, d);
        PlanWrites.StampCreated(ev, me);
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

        var error = PlanWrites.ApplyEvent(ev!, dto.Title, dto.Time, dto.Note, dto.TrainingType, dto.Minutes, dto.EndTime);
        if (error != null) return error;
        PlanWrites.StampUpdated(ev!, me!);
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

    // Dersin başlangıcı. null mevcut değeri korur (başlangıcı bilmeyen eski istemci düzenlerken saat kaybolmasın),
    // "" siler, SS:dd yazar. Aktivitedeki gibi serbest metin istisnası yok: ders saati hiçbir zaman serbest metin olmadı.
    private static bool TryParseStartTime(string? value, string? current, out string? start)
    {
        start = current;
        if (value == null) return true;
        var t = value.Trim();
        start = t.Length == 0 ? null : t;
        return t.Length == 0 || PlanText.IsTime(t);
    }

    private static ObjectResult InvalidStartTime() =>
        Err.BadRequest("validation", "Başlangıç saati SS:dd biçiminde olmalı (örn. 15:00).");

    // Günün etkinlik listesi: önce saati olanlar saat sırasıyla, sonra saatsizler (ve eski serbest metin saatliler)
    // eklenme sırasıyla. Aynı saatte normal kayıtlar tekrarlardan önce gelir; normal kayıtların kendi sırası
    // seriler eklenmeden önceki sırayla aynıdır.
    private static List<EventDto> DayEvents(DateOnly date, Day? day, List<EventSeries> series, FamilyMember me, AuditLookup audit) =>
        (day?.Events ?? []).Select(e => (Dto: Map(e, me, audit), IsSeries: 0, Key: e.Id))
            .Concat(series
                .Where(x => SeriesSchedule.IsOccurrence(x.DaysOfWeek, x.StartDate, x.UntilDate, date)
                            && !x.Exceptions.Any(ex => ex.Date == date) && Holidays.Shows(x.Kind, date))
                .Select(x => (Dto: MapOccurrence(x, date, me, audit), IsSeries: 1, Key: x.Id)))
            .OrderBy(x => PlanText.IsTime(x.Dto.Time) ? 0 : 1)
            .ThenBy(x => PlanText.IsTime(x.Dto.Time) ? x.Dto.Time : "", StringComparer.Ordinal)
            .ThenBy(x => x.IsSeries)
            .ThenBy(x => x.Key)
            .Select(x => x.Dto)
            .ToList();

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

    // Aralığa uğrayan seriler, yalnızca aralıktaki istisnalarıyla birlikte tek sorguda. Tekrar günleri bellekte
    // yayılır (DayEvents); aralık en fazla 7 gün olduğundan istisna satırı da en fazla 7 × seri sayısı kadardır.
    private Task<List<EventSeries>> LoadSeriesAsync(int familyId, DateOnly from, DateOnly to) =>
        db.EventSeries
            .AsNoTracking()
            .Include(x => x.Exceptions.Where(ex => ex.Date >= from && ex.Date <= to))
            .Where(x => x.FamilyId == familyId && x.StartDate <= to && x.UntilDate >= from)
            .ToListAsync();

    private Task<AuditLookup> LoadAuditAsync(FamilyMember me, List<Day> days, List<EventSeries> series) =>
        AuditLookup.LoadAsync(db, me.FamilyId,
            days.SelectMany(x => x.StudyEntries.Cast<AuditedEntity>().Concat(x.Events)).Concat(series), me);

    private static DayDto ToDayDto(DateOnly date, Day? day, List<EventSeries> series, FamilyMember me, AuditLookup audit) =>
        new(PlanText.Format(date),
            day?.StudyEntries.OrderBy(e => e.Id).Select(e => Map(e, me, audit)).ToList() ?? [],
            DayEvents(date, day, series, me, audit),
            HolidaysOn(date));

    private static List<HolidayDto> HolidaysOn(DateOnly date) =>
        Holidays.On(date).Select(h => new HolidayDto(h.Name, h.Kind)).ToList();

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
        new(e.Id, e.Subject, e.Topic, e.Minutes, e.Status, MemberContext.CanEdit(me, e), a.Get(e.CreatedByMemberId), e.CreatedAt, a.Get(e.UpdatedByMemberId), e.UpdatedAt, e.IsImported,
            e.StartTime, PlanText.StudyEndTime(e.StartTime, e.Minutes));
    internal static EventDto Map(Event e, FamilyMember me, AuditLookup a) =>
        new(e.Id, e.Kind.ToString(), e.Title, e.Time, e.Note, e.TrainingType, e.Minutes, MemberContext.CanEdit(me, e),
            a.Get(e.CreatedByMemberId), e.CreatedAt, a.Get(e.UpdatedByMemberId), e.UpdatedAt, e.IsImported,
            PlanText.EndTime(e.Time, e.EndTime), PlanText.DerivedEndTime(e.Time, PlanText.EndTime(e.Time, e.EndTime), e.Minutes));

    // Serinin bir günü. Sporda bile süre yok (seri süre tutmaz); bitiş yalnızca girilmiş bitiştir.
    private static EventDto MapOccurrence(EventSeries s, DateOnly date, FamilyMember me, AuditLookup a) =>
        new(0, s.Kind.ToString(), s.Title, s.Time, s.Note, null, null, MemberContext.CanEdit(me, s),
            a.Get(s.CreatedByMemberId), s.CreatedAt, a.Get(s.UpdatedByMemberId), s.UpdatedAt, false,
            PlanText.EndTime(s.Time, s.EndTime), null,
            s.Id, PlanText.Format(date),
            new RecurrenceDto(SeriesSchedule.IsoDays(s.DaysOfWeek), PlanText.Format(s.StartDate), PlanText.Format(s.UntilDate)));
}
