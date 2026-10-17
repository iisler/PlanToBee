using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using PlanToBee.API.Data;
using PlanToBee.API.Infrastructure;
using PlanToBee.API.Models;

namespace PlanToBee.API.Services;

// Plan kayıtlarına yazan uç noktaların (DaysController, SeriesController) ortak kuralları.
public static class PlanWrites
{
    // Türüne göre alanları doğrular ve kayda yazar. Her aktivitenin adı olur; yalnızca eski antrenman kayıtları ad
    // yerine TrainingType ile gelebilir. Süre yalnızca sporda tutulur. Saat boş ya da SS:dd olmalı; eski kayıtlardaki
    // serbest metin saat, değiştirilmeden geri gönderildiyse kabul edilir.
    // endTime: "" bitişi siler, null mevcut bitişi korur (bitişi bilmeyen eski istemci düzenlerken veri kaybolmasın).
    public static ObjectResult? ApplyEvent(Event ev, string? title, string? time, string? note, string? trainingType, int? minutes,
        string? endTime)
    {
        var t = time?.Trim() ?? "";
        if (t.Length > 0 && !PlanText.IsTime(t) && t != ev.Time)
            return Err.BadRequest("validation", "Saat SS:dd biçiminde olmalı (örn. 17:30).");
        string? end;
        if (endTime == null)
        {
            // Korunan bitiş, eski istemcinin değiştirdiği başlangıçla anlamsızlaşırsa (saat silindi ya da bitişe
            // eşitlendi) düşürülür; bitişi göremeyen istemciye 400 dönmek düzenlemeyi kilitlerdi.
            end = ev.EndTime != null && PlanText.IsTime(t) && t != ev.EndTime ? ev.EndTime : null;
        }
        else
        {
            var e = endTime.Trim();
            if (e.Length == 0) end = null;
            else if (!PlanText.IsTime(e)) return Err.BadRequest("validation", "Bitiş saati SS:dd biçiminde olmalı (örn. 13:00).");
            else if (!PlanText.IsTime(t)) return Err.BadRequest("validation", "Bitiş saati için önce başlangıç saatini girin.");
            else if (e == t) return Err.BadRequest("validation", "Bitiş saati başlangıçla aynı olamaz.");
            else end = e;
        }
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
        ev.EndTime = end;
        ev.Note = note?.Trim() ?? "";
        return null;
    }

    public static void StampCreated(AuditedEntity e, FamilyMember by)
    {
        e.CreatedByMemberId = by.Id;
        e.CreatedAt = DateTime.UtcNow;
    }

    public static void StampUpdated(AuditedEntity e, FamilyMember by)
    {
        e.UpdatedByMemberId = by.Id;
        e.UpdatedAt = DateTime.UtcNow;
    }

    // Aynı gün için eşzamanlı iki yazma isteği gelirse ikisi de gün oluşturmaya çalışır;
    // (FamilyId, Date) benzersiz indeksine takılan istek, diğerinin oluşturduğu günü kullanır.
    public static async Task<int> GetOrCreateDayIdAsync(AppDbContext db, int familyId, DateOnly date)
    {
        var id = await FindDayId(db, familyId, date);
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
            return await FindDayId(db, familyId, date) ?? throw new InvalidOperationException("Gün oluşturulamadı");
        }
    }

    private static Task<int?> FindDayId(AppDbContext db, int familyId, DateOnly date) =>
        db.Days.Where(d => d.FamilyId == familyId && d.Date == date).Select(d => (int?)d.Id).FirstOrDefaultAsync();
}
