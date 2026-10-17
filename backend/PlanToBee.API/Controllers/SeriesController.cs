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

// Tekrarlayan aktiviteler (haftalık seri). Seri tek kural olarak saklanır; günlere GET /api/days uçları yayar.
// Yetki aktivitelerle aynı: ailedeki herkes seri ekler, ebeveyn hepsini, çocuk yalnızca kendi eklediğini değiştirir.
// Bildirim yalnızca seri olaylarında gider (ekleme, düzenleme, silme, tek günü silme/ayırma); her tekrar günü için değil.
[ApiController]
[Route("api/series")]
[Authorize]
[RequireVerifiedEmail]
[EnableRateLimiting(RateLimitPolicies.Api)]
public class SeriesController(AppDbContext db, MemberContext members, NotificationService notifications) : ControllerBase
{
    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var me = await members.GetCurrentAsync();
        if (me == null) return await members.MissingAsync();
        var series = await db.EventSeries.AsNoTracking().Include(x => x.Exceptions)
            .FirstOrDefaultAsync(x => x.Id == id && x.FamilyId == me.FamilyId);
        if (series == null) return Err.NotFound();
        return Ok(await MapOne(series, me));
    }

    [HttpPost]
    public async Task<IActionResult> Create(AddSeriesDto dto)
    {
        var kind = dto.Kind ?? EventKind.Event;
        if (!Enum.IsDefined(kind)) return Err.BadRequest("validation", "Geçersiz kayıt türü.");
        if (!PlanText.TryParseDate(dto.StartDate, out var startDate)) return InvalidDate();
        var series = new EventSeries { Kind = kind, StartDate = startDate };
        var error = ApplyRule(series, dto.Title, dto.Time, dto.EndTime, dto.Note, dto.DaysOfWeek, dto.UntilDate);
        if (error != null) return error;

        // "Geri al": silinen serinin istisnaları geri yüklenir; yalnızca serinin tarih aralığındaki günler.
        var skipped = new HashSet<DateOnly>();
        foreach (var raw in dto.Exceptions ?? [])
        {
            if (!PlanText.TryParseDate(raw, out var d) || d < series.StartDate || d > series.UntilDate)
                return Err.BadRequest("validation", "İstisna günleri tekrarın tarih aralığında olmalı.");
            skipped.Add(d);
        }
        var me = await members.GetCurrentAsync();
        if (me == null) return await members.MissingAsync();

        series.FamilyId = me.FamilyId;
        series.Exceptions = skipped.Select(d => new EventSeriesException { Date = d }).ToList();
        PlanWrites.StampCreated(series, me);
        db.EventSeries.Add(series);
        await db.SaveChangesAsync();
        await notifications.EnqueueAsync(me, NotificationCategory.ActivityAdded, $"{me.DisplayName} tekrarlayan aktivite ekledi",
            NotificationText.Series(series), series.StartDate);
        return Ok(await MapOne(series, me));
    }

    // "Tüm tekrarlar" düzenleme: kural değişir; istisnalar (silinen ve ayrılan günler) korunur.
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateSeriesDto dto)
    {
        var (me, series, authError) = await AuthorizeSeries(id, withExceptions: true);
        if (authError != null) return authError;
        var error = ApplyRule(series!, dto.Title, dto.Time, dto.EndTime, dto.Note, dto.DaysOfWeek, dto.UntilDate);
        if (error != null) return error;
        PlanWrites.StampUpdated(series!, me!);
        await db.SaveChangesAsync();
        await notifications.EnqueueAsync(me!, NotificationCategory.Changed, $"{me!.DisplayName} tekrarlayan bir aktiviteyi değiştirdi",
            NotificationText.Series(series!), NotifyDate(series!));
        return Ok(await MapOne(series!, me));
    }

    // "Tüm tekrarlar" silme: from (istemcinin bugünü) ve sonrası silinir. Seri from'dan önce başlamışsa ve öncesinde
    // en az bir günü varsa kısaltılır (UntilDate = from - 1; geçmiş günler kalır); değilse ya da from yoksa tamamen
    // silinir. Ayrılmış günler normal aktivite olduğundan kalır. Cevap silmeden önceki seridir ("Geri al" için).
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, [FromQuery] string? from)
    {
        DateOnly? fromDate = null;
        if (from != null)
        {
            if (!PlanText.TryParseDate(from, out var f)) return InvalidDate();
            fromDate = f;
        }
        var (me, series, authError) = await AuthorizeSeries(id, withExceptions: true);
        if (authError != null) return authError;
        var before = await MapOne(series!, me!);
        var text = NotificationText.Series(series!); // kısaltmadan önceki kural
        var until = fromDate?.AddDays(-1);
        var truncate = until != null && fromDate <= series!.UntilDate && until >= series.StartDate
            && SeriesSchedule.HasAny(series.DaysOfWeek, series.StartDate, until.Value);
        if (truncate)
        {
            // İstisnalar korunur: "Geri al" (PUT) eski bitiş tarihini geri yazınca aynen geçerli olurlar.
            series!.UntilDate = until!.Value;
            PlanWrites.StampUpdated(series, me!);
            await db.SaveChangesAsync();
        }
        else
        {
            await db.EventSeries.Where(x => x.Id == id).ExecuteDeleteAsync(); // istisnalar veritabanında cascade ile
        }
        await notifications.EnqueueAsync(me!, NotificationCategory.Deleted, $"{me!.DisplayName} tekrarlayan bir aktiviteyi sildi",
            text, truncate ? fromDate!.Value : NotifyDate(series!));
        return Ok(new DeleteSeriesResultDto(truncate, before));
    }

    // "Yalnızca bu gün" silme. Aynı gün zaten atlanmışsa (çift tıklama, iki cihaz) yine 204: işlem idempotent.
    [HttpPost("{id:int}/skip")]
    public async Task<IActionResult> Skip(int id, SkipSeriesDateDto dto)
    {
        if (!PlanText.TryParseDate(dto.Date, out var date)) return InvalidDate();
        var (me, series, authError) = await AuthorizeSeries(id);
        if (authError != null) return authError;
        if (!SeriesSchedule.IsOccurrence(series!.DaysOfWeek, series.StartDate, series.UntilDate, date)) return NotOccurrence();
        if (await db.EventSeriesExceptions.AnyAsync(x => x.SeriesId == id && x.Date == date)) return NoContent();

        db.EventSeriesExceptions.Add(new EventSeriesException { SeriesId = id, Date = date });
        var saveError = await SaveExceptionAsync(onDuplicate: NoContent());
        if (saveError != null) return saveError;
        await notifications.EnqueueAsync(me!, NotificationCategory.Deleted, $"{me!.DisplayName} bir aktiviteyi sildi",
            $"{NotificationText.Activity(Occurrence(series))} — {NotificationText.Date(date)}", date);
        return NoContent();
    }

    // "Yalnızca bu gün" silmenin "Geri al"ı: o tarihin istisnası kalkar, gün yeniden tekrarı gösterir. İstisna yoksa da
    // 204 (idempotent). Ayrılmış günde çağrılırsa ayrılan aktivite durur, tekrar da görünür; istemci bunu yalnızca
    // skip'in hemen ardından çağırır. Geri alma bildirim üretmez.
    [HttpPost("{id:int}/restore")]
    public async Task<IActionResult> Restore(int id, SkipSeriesDateDto dto)
    {
        if (!PlanText.TryParseDate(dto.Date, out var date)) return InvalidDate();
        var (_, _, authError) = await AuthorizeSeries(id);
        if (authError != null) return authError;
        await db.EventSeriesExceptions.Where(x => x.SeriesId == id && x.Date == date).ExecuteDeleteAsync();
        return NoContent();
    }

    // "Yalnızca bu gün" düzenleme: o tarih seriden çıkar (istisna) ve o güne gönderilen alanlarla normal aktivite
    // eklenir; ikisi tek SaveChanges'ta (tek transaction) yazılır. Cevap yeni aktivitedir (GET /api/days biçiminde).
    [HttpPost("{id:int}/detach")]
    public async Task<IActionResult> Detach(int id, DetachSeriesDateDto dto)
    {
        if (!PlanText.TryParseDate(dto.Date, out var date)) return InvalidDate();
        var (me, series, authError) = await AuthorizeSeries(id);
        if (authError != null) return authError;
        if (!SeriesSchedule.IsOccurrence(series!.DaysOfWeek, series.StartDate, series.UntilDate, date)) return NotOccurrence();
        var ev = new Event { Kind = series.Kind };
        var error = PlanWrites.ApplyEvent(ev, dto.Title, dto.Time, dto.Note, null, null, dto.EndTime ?? "");
        if (error != null) return error;
        if (await db.EventSeriesExceptions.AnyAsync(x => x.SeriesId == id && x.Date == date)) return OccurrenceGone();

        ev.DayId = await PlanWrites.GetOrCreateDayIdAsync(db, me!.FamilyId, date);
        // Ekleyen serinin ekleyeni kalır: çocuk kendi serisinden ayrılan günü (ebeveyn ayırmış olsa da) düzenleyebilir.
        ev.CreatedByMemberId = series.CreatedByMemberId;
        ev.CreatedAt = series.CreatedAt;
        PlanWrites.StampUpdated(ev, me);
        db.Events.Add(ev);
        db.EventSeriesExceptions.Add(new EventSeriesException { SeriesId = id, Date = date });
        var saveError = await SaveExceptionAsync(onDuplicate: OccurrenceGone());
        if (saveError != null) return saveError;
        await notifications.EnqueueAsync(me, NotificationCategory.Changed, $"{me.DisplayName} bir aktiviteyi değiştirdi",
            $"{NotificationText.Activity(ev)} — {NotificationText.Date(date)}", date);
        var audit = await AuditLookup.LoadAsync(db, me.FamilyId, [ev], me);
        return Ok(DaysController.Map(ev, me, audit));
    }

    // ---------- Yardımcılar ----------

    // Seri bulunamazsa ya da başka ailedeyse 404 (varlığı belli edilmez), düzenleme yetkisi yoksa 403.
    private async Task<(FamilyMember? Me, EventSeries? Series, IActionResult? Error)> AuthorizeSeries(int id, bool withExceptions = false)
    {
        var me = await members.GetCurrentAsync();
        if (me == null) return (null, null, await members.MissingAsync());
        var query = withExceptions ? db.EventSeries.Include(x => x.Exceptions) : db.EventSeries.AsQueryable();
        var series = await query.FirstOrDefaultAsync(x => x.Id == id && x.FamilyId == me.FamilyId);
        if (series == null) return (null, null, Err.NotFound());
        if (!MemberContext.CanEdit(me, series)) return (null, null, Err.ReadOnly());
        return (me, series, null);
    }

    // Eşzamanlı istekler: aynı gün için ikinci istisna benzersiz indekse takılır (onDuplicate), seri bu arada
    // silindiyse yabancı anahtar ihlali olur (404).
    private async Task<IActionResult?> SaveExceptionAsync(IActionResult onDuplicate)
    {
        try
        {
            await db.SaveChangesAsync();
            return null;
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return onDuplicate;
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.ForeignKeyViolation })
        {
            return Err.NotFound();
        }
    }

    // Kuralın alanlarını doğrular ve yalnızca hepsi geçerliyse seriye yazar. Ad, saat ve bitiş kuralları tek
    // aktiviteyle aynıdır (PlanWrites.ApplyEvent); sporda süre tutulmaz. Tür ve başlangıç tarihi burada değişmez.
    private static ObjectResult? ApplyRule(EventSeries s, string? title, string? time, string? endTime, string? note,
        List<int>? days, string? until)
    {
        var fields = new Event { Kind = s.Kind };
        var error = PlanWrites.ApplyEvent(fields, title, time, note, null, null, endTime ?? "");
        if (error != null) return error;
        if (days == null || days.Count == 0) return Err.BadRequest("validation", "Tekrar için en az bir gün seçin.");
        if (SeriesSchedule.Mask(days) is not int mask) return Err.BadRequest("validation", "Geçersiz gün.");
        if (!PlanText.TryParseDate(until, out var untilDate))
            return Err.BadRequest("validation", "Tekrarın bitiş tarihini seçin (yyyy-AA-gg).");
        if (untilDate < s.StartDate) return Err.BadRequest("validation", "Bitiş tarihi başlangıçtan önce olamaz.");
        if (untilDate > s.StartDate.AddYears(1)) return Err.BadRequest("validation", "Tekrar en fazla 1 yıl sürebilir.");
        if (!SeriesSchedule.HasAny(mask, s.StartDate, untilDate))
            return Err.BadRequest("validation", "Seçilen günler bu tarih aralığına denk gelmiyor.");

        s.Title = fields.Title;
        s.Time = fields.Time;
        s.EndTime = fields.EndTime;
        s.Note = fields.Note;
        s.DaysOfWeek = mask;
        s.UntilDate = untilDate;
        return null;
    }

    // Serinin tek bir günü, bildirim metni için.
    private static Event Occurrence(EventSeries s) =>
        new() { Kind = s.Kind, Title = s.Title, Time = s.Time, EndTime = s.EndTime, Note = s.Note };

    // Seri bildirimi açılınca gösterilecek gün: bugün (Türkiye saati) serinin aralığına sıkıştırılır.
    private static DateOnly NotifyDate(EventSeries s)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow + QuietHours.Offset);
        return today < s.StartDate ? s.StartDate : today > s.UntilDate ? s.UntilDate : today;
    }

    private async Task<SeriesDto> MapOne(EventSeries s, FamilyMember me)
    {
        var a = await AuditLookup.LoadAsync(db, me.FamilyId, [s], me);
        return new SeriesDto(s.Id, s.Kind.ToString(), s.Title, s.Time, PlanText.EndTime(s.Time, s.EndTime), s.Note,
            SeriesSchedule.IsoDays(s.DaysOfWeek), PlanText.Format(s.StartDate), PlanText.Format(s.UntilDate),
            s.Exceptions.Select(x => x.Date).Order().Select(PlanText.Format).ToList(),
            MemberContext.CanEdit(me, s), a.Get(s.CreatedByMemberId), s.CreatedAt, a.Get(s.UpdatedByMemberId), s.UpdatedAt);
    }

    private static ObjectResult InvalidDate() =>
        Err.BadRequest("invalid_date", "Geçersiz tarih. Tarih yyyy-AA-gg biçiminde olmalı.");

    private static ObjectResult NotOccurrence() =>
        Err.BadRequest("not_occurrence", "Bu tarih tekrarın günlerinden biri değil.");

    private static ObjectResult OccurrenceGone() =>
        Err.Conflict("occurrence_gone", "Bu gün tekrardan zaten çıkarılmış.");
}
