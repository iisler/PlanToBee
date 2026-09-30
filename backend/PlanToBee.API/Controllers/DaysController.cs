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

namespace PlanToBee.API.Controllers;

// Ailenin ortak gün ve hafta planı. Ailedeki herkes kayıt ekleyebilir; bir kaydı ebeveynler
// ve kaydı ekleyen kişi düzenleyip silebilir (MemberContext.CanEdit).
[ApiController]
[Route("api/days")]
[Authorize]
[RequireVerifiedEmail]
[EnableRateLimiting(RateLimitPolicies.Api)]
public class DaysController(AppDbContext db, MemberContext members) : ControllerBase
{
    private static readonly string[] ValidStatuses = ["todo", "inprogress", "done"];

    [HttpGet("{date}")]
    public async Task<IActionResult> GetDay(string date)
    {
        if (!PlanText.TryParseDate(date, out var d)) return InvalidDate();
        var me = await members.GetCurrentAsync();
        if (me == null) return Err.FamilyRequired();

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
        if (me == null) return Err.FamilyRequired();

        var end = start.AddDays(6);
        var totals = await db.Days
            .AsNoTracking()
            .Where(d => d.FamilyId == me.FamilyId && d.Date >= start && d.Date <= end)
            .Select(d => new
            {
                d.Date,
                StudyMinutes = d.StudyEntries.Sum(e => (long)e.Minutes),
                EntryCount = d.StudyEntries.Count,
                TrainingCount = d.TrainingEntries.Count,
                EventCount = d.Events.Count
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
        if (me == null) return Err.FamilyRequired();

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
        if (me == null) return Err.FamilyRequired();

        var dayId = await GetOrCreateDayId(me.FamilyId, d);
        var entry = new StudyEntry { DayId = dayId, Subject = dto.Subject.Trim(), Topic = dto.Topic?.Trim() ?? "", Minutes = dto.Minutes, Status = "todo" };
        StampCreated(entry, me);
        db.StudyEntries.Add(entry);
        await db.SaveChangesAsync();
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

        entry!.Subject = dto.Subject.Trim();
        entry.Topic = dto.Topic?.Trim() ?? "";
        entry.Minutes = dto.Minutes;
        if (dto.Status != null) entry.Status = dto.Status;
        StampUpdated(entry, me!);
        await db.SaveChangesAsync();
        return Ok(await MapOne(entry, me!));
    }

    [HttpPatch("{date}/entries/{id:int}/status")]
    public async Task<IActionResult> PatchStatus(string date, int id, PatchStatusDto dto)
    {
        if (!ValidStatuses.Contains(dto.Status)) return Err.BadRequest("validation", "Geçersiz durum.");
        var entry = await db.StudyEntries.Include(e => e.Day).FirstOrDefaultAsync(e => e.Id == id);
        var (me, error) = await AuthorizeEntry(date, entry);
        if (error != null) return error;

        entry!.Status = dto.Status; // durum değiştirmek de düzenleme sayılır
        StampUpdated(entry, me!);
        await db.SaveChangesAsync();
        return Ok(await MapOne(entry, me!));
    }

    [HttpDelete("{date}/entries/{id:int}")]
    public async Task<IActionResult> DeleteEntry(string date, int id)
    {
        var entry = await db.StudyEntries.Include(e => e.Day).FirstOrDefaultAsync(e => e.Id == id);
        var (_, error) = await AuthorizeEntry(date, entry);
        if (error != null) return error;
        db.StudyEntries.Remove(entry!);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---------- Antrenman kayıtları ----------

    [HttpPost("{date}/training")]
    public async Task<IActionResult> AddTraining(string date, AddTrainingDto dto)
    {
        if (!PlanText.TryParseDate(date, out var d)) return InvalidDate();
        if (string.IsNullOrWhiteSpace(dto.Type)) return Err.BadRequest("validation", "Antrenman türü seçin.");
        var me = await members.GetCurrentAsync();
        if (me == null) return Err.FamilyRequired();

        var dayId = await GetOrCreateDayId(me.FamilyId, d);
        var entry = new TrainingEntry { DayId = dayId, Type = dto.Type.Trim(), Minutes = dto.Minutes, Note = dto.Note?.Trim() ?? "" };
        StampCreated(entry, me);
        db.TrainingEntries.Add(entry);
        await db.SaveChangesAsync();
        return Ok(await MapOne(entry, me));
    }

    [HttpPut("{date}/training/{id:int}")]
    public async Task<IActionResult> UpdateTraining(string date, int id, UpdateTrainingDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Type)) return Err.BadRequest("validation", "Antrenman türü seçin.");
        var entry = await db.TrainingEntries.Include(e => e.Day).FirstOrDefaultAsync(e => e.Id == id);
        var (me, error) = await AuthorizeEntry(date, entry);
        if (error != null) return error;

        entry!.Type = dto.Type.Trim();
        entry.Minutes = dto.Minutes;
        entry.Note = dto.Note?.Trim() ?? "";
        StampUpdated(entry, me!);
        await db.SaveChangesAsync();
        return Ok(await MapOne(entry, me!));
    }

    [HttpDelete("{date}/training/{id:int}")]
    public async Task<IActionResult> DeleteTraining(string date, int id)
    {
        var entry = await db.TrainingEntries.Include(e => e.Day).FirstOrDefaultAsync(e => e.Id == id);
        var (_, error) = await AuthorizeEntry(date, entry);
        if (error != null) return error;
        db.TrainingEntries.Remove(entry!);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---------- Etkinlikler ----------

    [HttpPost("{date}/events")]
    public async Task<IActionResult> AddEvent(string date, AddEventDto dto)
    {
        if (!PlanText.TryParseDate(date, out var d)) return InvalidDate();
        if (string.IsNullOrWhiteSpace(dto.Title)) return Err.BadRequest("validation", "Etkinlik adı girin.");
        var me = await members.GetCurrentAsync();
        if (me == null) return Err.FamilyRequired();

        var dayId = await GetOrCreateDayId(me.FamilyId, d);
        var ev = new Event { DayId = dayId, Title = dto.Title.Trim(), Time = dto.Time?.Trim() ?? "", Note = dto.Note?.Trim() ?? "" };
        StampCreated(ev, me);
        db.Events.Add(ev);
        await db.SaveChangesAsync();
        return Ok(await MapOne(ev, me));
    }

    [HttpPut("{date}/events/{id:int}")]
    public async Task<IActionResult> UpdateEvent(string date, int id, UpdateEventDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title)) return Err.BadRequest("validation", "Etkinlik adı girin.");
        var ev = await db.Events.Include(e => e.Day).FirstOrDefaultAsync(e => e.Id == id);
        var (me, error) = await AuthorizeEntry(date, ev);
        if (error != null) return error;

        ev!.Title = dto.Title.Trim(); ev.Time = dto.Time?.Trim() ?? ""; ev.Note = dto.Note?.Trim() ?? "";
        StampUpdated(ev, me!);
        await db.SaveChangesAsync();
        return Ok(await MapOne(ev, me!));
    }

    [HttpDelete("{date}/events/{id:int}")]
    public async Task<IActionResult> DeleteEvent(string date, int id)
    {
        var ev = await db.Events.Include(e => e.Day).FirstOrDefaultAsync(e => e.Id == id);
        var (_, error) = await AuthorizeEntry(date, ev);
        if (error != null) return error;
        db.Events.Remove(ev!);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---------- Yardımcılar ----------

    // Kayıt yoksa, başka ailedeyse ya da rotadaki tarihte değilse 404 (varlığı belli edilmez);
    // görülebiliyor ama istek sahibi düzenleyemiyorsa 403.
    private async Task<(FamilyMember? Me, IActionResult? Error)> AuthorizeEntry(string date, AuditedEntity? entry)
    {
        if (!PlanText.TryParseDate(date, out var d)) return (null, InvalidDate());
        var me = await members.GetCurrentAsync();
        if (me == null) return (null, Err.FamilyRequired());
        var day = entry switch
        {
            StudyEntry s => s.Day,
            TrainingEntry t => t.Day,
            Event e => e.Day,
            _ => null
        };
        if (entry == null || day == null || day.FamilyId != me.FamilyId || day.Date != d) return (null, Err.NotFound());
        if (!MemberContext.CanEdit(me, entry)) return (null, Err.ReadOnly());
        return (me, null);
    }

    private static ObjectResult InvalidDate() =>
        Err.BadRequest("invalid_date", "Geçersiz tarih. Tarih yyyy-AA-gg biçiminde olmalı.");

    // Günleri kayıtlarıyla yükler. Üç koleksiyon ayrı sorgularla (split query) okunur; tek sorguda
    // birleştirmek ders × antrenman × etkinlik sayısı kadar satır (kartezyen çarpım) üretirdi.
    private Task<List<Day>> LoadDaysAsync(int familyId, DateOnly from, DateOnly to) =>
        db.Days
            .AsNoTracking()
            .AsSplitQuery()
            .Include(x => x.StudyEntries)
            .Include(x => x.TrainingEntries)
            .Include(x => x.Events)
            .Where(x => x.FamilyId == familyId && x.Date >= from && x.Date <= to)
            .ToListAsync();

    private Task<AuditLookup> LoadAuditAsync(FamilyMember me, List<Day> days) =>
        AuditLookup.LoadAsync(db, me.FamilyId,
            days.SelectMany(x => x.StudyEntries.Cast<AuditedEntity>().Concat(x.TrainingEntries).Concat(x.Events)), me);

    private static DayDto ToDayDto(DateOnly date, Day? day, FamilyMember me, AuditLookup audit) =>
        day == null
            ? new DayDto(PlanText.Format(date), [], [], [])
            : new DayDto(
                PlanText.Format(date),
                day.StudyEntries.OrderBy(e => e.Id).Select(e => Map(e, me, audit)).ToList(),
                day.TrainingEntries.OrderBy(e => e.Id).Select(e => Map(e, me, audit)).ToList(),
                day.Events.OrderBy(e => e.Id).Select(e => Map(e, me, audit)).ToList());

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
            TrainingEntry t => Map(t, me, audit),
            Event ev => Map(ev, me, audit),
            _ => throw new ArgumentException(nameof(e))
        };
    }

    private static StudyEntryDto Map(StudyEntry e, FamilyMember me, AuditLookup a) =>
        new(e.Id, e.Subject, e.Topic, e.Minutes, e.Status, MemberContext.CanEdit(me, e), a.Get(e.CreatedByMemberId), e.CreatedAt, a.Get(e.UpdatedByMemberId), e.UpdatedAt, e.IsImported);
    private static TrainingEntryDto Map(TrainingEntry e, FamilyMember me, AuditLookup a) =>
        new(e.Id, e.Type, e.Minutes, e.Note, MemberContext.CanEdit(me, e), a.Get(e.CreatedByMemberId), e.CreatedAt, a.Get(e.UpdatedByMemberId), e.UpdatedAt, e.IsImported);
    private static EventDto Map(Event e, FamilyMember me, AuditLookup a) =>
        new(e.Id, e.Title, e.Time, e.Note, MemberContext.CanEdit(me, e), a.Get(e.CreatedByMemberId), e.CreatedAt, a.Get(e.UpdatedByMemberId), e.UpdatedAt, e.IsImported);

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
