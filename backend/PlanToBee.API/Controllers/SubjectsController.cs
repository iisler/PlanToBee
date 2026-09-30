using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using PlanToBee.API.Data;
using PlanToBee.API.DTOs;
using PlanToBee.API.Infrastructure;
using PlanToBee.API.Models;
using PlanToBee.API.Services;

namespace PlanToBee.API.Controllers;

// Ders listesi ailenin ortak planına aittir. Ailedeki herkes ders ekleyebilir; bir dersi ebeveynler
// ve dersi ekleyen kişi silebilir. Varsayılan dersleri (ekleyeni yok) yalnızca ebeveynler silebilir.
[ApiController]
[Route("api/subjects")]
[Authorize]
[RequireVerifiedEmail]
[EnableRateLimiting(RateLimitPolicies.Api)]
public class SubjectsController(AppDbContext db, MemberContext members) : ControllerBase
{
    private static readonly string[] DefaultSubjects =
        ["Matematik", "Geometri", "Fizik", "Kimya", "Biyoloji", "Türkçe", "Tarih", "Coğrafya", "Felsefe", "İngilizce"];

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var me = await members.GetCurrentAsync();
        if (me == null) return Err.FamilyRequired();

        var subjects = await LoadAsync(me.FamilyId);
        if (subjects.Count == 0)
        {
            // Liste boşsa varsayılan dersler eklenir (sistem tarafından, ekleyen boş). Aynı anda gelen iki
            // istek listeyi iki kez eklemesin diye aile kilidi alınır ve liste kilit altında yeniden okunur.
            await using var tx = await db.Database.BeginTransactionAsync();
            await PlanLocks.LockSubjectsAsync(db, me.FamilyId);
            subjects = await LoadAsync(me.FamilyId);
            if (subjects.Count == 0)
            {
                var now = DateTime.UtcNow;
                subjects = DefaultSubjects.Select(n => new Subject { FamilyId = me.FamilyId, Name = n, CreatedAt = now }).ToList();
                db.Subjects.AddRange(subjects);
                await db.SaveChangesAsync();
            }
            await tx.CommitAsync();
        }

        var audit = await AuditLookup.LoadAsync(db, me.FamilyId, subjects);
        return Ok(new SubjectListDto(subjects.Select(s => Map(s, me, audit)).ToList()));
    }

    // Gövde geriye dönük uyumluluk için düz JSON metnidir: "Ders adı"
    [HttpPost]
    public async Task<IActionResult> Add([FromBody] string name)
    {
        name = (name ?? "").Trim();
        if (string.IsNullOrEmpty(name)) return Err.BadRequest("validation", "Ders adı boş olamaz.");
        if (name.Length > 100) return Err.BadRequest("validation", "Ders adı en fazla 100 karakter olabilir.");
        var me = await members.GetCurrentAsync();
        if (me == null) return Err.FamilyRequired();

        // Aynı adın eşzamanlı iki istekle iki kez eklenmemesi için kontrol ve ekleme aile kilidi altında yapılır.
        // Türkçe kurallarıyla büyük/küçük harf duyarsız karşılaştırma (ör. "İngilizce" = "ingilizce")
        await using var tx = await db.Database.BeginTransactionAsync();
        await PlanLocks.LockSubjectsAsync(db, me.FamilyId);
        var existing = await db.Subjects.AsNoTracking().Where(s => s.FamilyId == me.FamilyId).Select(s => s.Name).ToListAsync();
        if (existing.Any(n => PlanText.TurkishIgnoreCase.Equals(n.Trim(), name)))
            return Err.Conflict("duplicate_subject", $"\"{name}\" zaten ders listesinde var.");
        var subject = new Subject { FamilyId = me.FamilyId, Name = name, CreatedByMemberId = me.Id, CreatedAt = DateTime.UtcNow };
        db.Subjects.Add(subject);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        var audit = await AuditLookup.LoadAsync(db, me.FamilyId, [subject], me);
        return Ok(Map(subject, me, audit));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var me = await members.GetCurrentAsync();
        if (me == null) return Err.FamilyRequired();
        var subject = await db.Subjects.FirstOrDefaultAsync(s => s.Id == id && s.FamilyId == me.FamilyId);
        if (subject == null) return Err.NotFound();
        if (!MemberContext.CanEdit(me, subject)) return Err.ReadOnly();
        db.Subjects.Remove(subject);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private Task<List<Subject>> LoadAsync(int familyId) =>
        db.Subjects.AsNoTracking().Where(s => s.FamilyId == familyId).OrderBy(s => s.Id).ToListAsync();

    private static SubjectDto Map(Subject s, FamilyMember me, AuditLookup a) =>
        new(s.Id, s.Name, MemberContext.CanEdit(me, s), a.Get(s.CreatedByMemberId), s.CreatedAt, a.Get(s.UpdatedByMemberId), s.UpdatedAt, s.IsImported);
}
