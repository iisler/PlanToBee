using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
public class DaysController(AppDbContext db, MemberContext members) : ControllerBase
{
    private static readonly string[] ValidStatuses = ["todo", "inprogress", "done"];

    [HttpGet("{date}")]
    public async Task<IActionResult> GetDay(string date)
    {
        if (!DateOnly.TryParse(date, out var d)) return Err.BadRequest("invalid_date", "Geçersiz tarih.");
        var me = await members.GetCurrentAsync();
        if (me == null) return Err.FamilyRequired();

        // Okuma kayıt oluşturmaz; gün yoksa boş döner.
        var day = await db.Days
            .AsNoTracking()
            .Include(x => x.StudyEntries)
            .Include(x => x.TrainingEntries)
            .Include(x => x.Events)
            .FirstOrDefaultAsync(x => x.FamilyId == me.FamilyId && x.Date == d);
        if (day == null) return Ok(new DayDto(date, [], [], []));

        var audit = await AuditLookup.LoadAsync(db, me.FamilyId,
            day.StudyEntries.Cast<AuditedEntity>().Concat(day.TrainingEntries).Concat(day.Events));
        return Ok(new DayDto(
            date,
            day.StudyEntries.OrderBy(e => e.Id).Select(e => Map(e, me, audit)).ToList(),
            day.TrainingEntries.OrderBy(e => e.Id).Select(e => Map(e, me, audit)).ToList(),
            day.Events.OrderBy(e => e.Id).Select(e => Map(e, me, audit)).ToList()));
    }

    [HttpGet("week/{monday}")]
    public async Task<IActionResult> GetWeek(string monday)
    {
        if (!DateOnly.TryParse(monday, out var start)) return Err.BadRequest("invalid_date", "Geçersiz tarih.");
        var me = await members.GetCurrentAsync();
        if (me == null) return Err.FamilyRequired();

        var dates = Enumerable.Range(0, 7).Select(i => start.AddDays(i)).ToList();
        var days = await db.Days
            .AsNoTracking()
            .Include(d => d.StudyEntries)
            .Include(d => d.TrainingEntries)
            .Include(d => d.Events)
            .Where(d => d.FamilyId == me.FamilyId && dates.Contains(d.Date))
            .ToListAsync();

        var result = dates.Select(date =>
        {
            var day = days.FirstOrDefault(d => d.Date == date);
            return new WeekSummaryDto(
                date.ToString("yyyy-MM-dd"),
                (int)Math.Min(int.MaxValue, day?.StudyEntries.Sum(e => (long)e.Minutes) ?? 0),
                day?.StudyEntries.Count ?? 0,
                day?.TrainingEntries.Count > 0,
                day?.TrainingEntries.Count ?? 0,
                day?.Events.Count ?? 0
            );
        }).ToList();
        return Ok(new WeekDto(result));
    }

    // ---------- Ders kayıtları ----------

    [HttpPost("{date}/entries")]
    public async Task<IActionResult> AddEntry(string date, AddStudyEntryDto dto)
    {
        if (!DateOnly.TryParse(date, out var d)) return Err.BadRequest("invalid_date", "Geçersiz tarih.");
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
        var (me, error) = await AuthorizeEntry(entry);
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
        var (me, error) = await AuthorizeEntry(entry);
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
        var (_, error) = await AuthorizeEntry(entry);
        if (error != null) return error;
        db.StudyEntries.Remove(entry!);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---------- Antrenman kayıtları ----------

    [HttpPost("{date}/training")]
    public async Task<IActionResult> AddTraining(string date, AddTrainingDto dto)
    {
        if (!DateOnly.TryParse(date, out var d)) return Err.BadRequest("invalid_date", "Geçersiz tarih.");
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
        var (me, error) = await AuthorizeEntry(entry);
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
        var (_, error) = await AuthorizeEntry(entry);
        if (error != null) return error;
        db.TrainingEntries.Remove(entry!);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---------- Etkinlikler ----------

    [HttpPost("{date}/events")]
    public async Task<IActionResult> AddEvent(string date, AddEventDto dto)
    {
        if (!DateOnly.TryParse(date, out var d)) return Err.BadRequest("invalid_date", "Geçersiz tarih.");
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
        var (me, error) = await AuthorizeEntry(ev);
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
        var (_, error) = await AuthorizeEntry(ev);
        if (error != null) return error;
        db.Events.Remove(ev!);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---------- Yardımcılar ----------

    // Kayıt yoksa veya başka ailedeyse 404 (varlığı belli edilmez); görülebiliyor ama
    // istek sahibi düzenleyemiyorsa 403.
    private async Task<(FamilyMember? Me, IActionResult? Error)> AuthorizeEntry(AuditedEntity? entry)
    {
        var me = await members.GetCurrentAsync();
        if (me == null) return (null, Err.FamilyRequired());
        var day = entry switch
        {
            StudyEntry s => s.Day,
            TrainingEntry t => t.Day,
            Event e => e.Day,
            _ => null
        };
        if (entry == null || day == null || day.FamilyId != me.FamilyId) return (null, Err.NotFound());
        if (!MemberContext.CanEdit(me, entry)) return (null, Err.ReadOnly());
        return (me, null);
    }

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
        var audit = await AuditLookup.LoadAsync(db, me.FamilyId, [e]);
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
        catch (DbUpdateException)
        {
            db.Entry(day).State = EntityState.Detached;
            return await FindDayId(familyId, date) ?? throw new InvalidOperationException("Gün oluşturulamadı");
        }
    }

    private Task<int?> FindDayId(int familyId, DateOnly date) =>
        db.Days.Where(d => d.FamilyId == familyId && d.Date == date).Select(d => (int?)d.Id).FirstOrDefaultAsync();
}
