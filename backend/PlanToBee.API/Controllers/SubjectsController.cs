using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PlanToBee.API.Data;
using PlanToBee.API.DTOs;
using PlanToBee.API.Infrastructure;
using PlanToBee.API.Models;
using PlanToBee.API.Services;

namespace PlanToBee.API.Controllers;

// Ders listesi plan başınadır. ?memberId= verilmezse istek sahibinin planı kullanılır.
// Listeyi o planda yazma yetkisi olan kişi yönetir.
[ApiController]
[Route("api/subjects")]
[Authorize]
[RequireVerifiedEmail]
public class SubjectsController(AppDbContext db, MemberContext members) : ControllerBase
{
    private static readonly StringComparer TurkishIgnoreCase =
        StringComparer.Create(new System.Globalization.CultureInfo("tr-TR"), ignoreCase: true);

    private static readonly string[] DefaultSubjects =
        ["Matematik", "Geometri", "Fizik", "Kimya", "Biyoloji", "Türkçe", "Tarih", "Coğrafya", "Felsefe", "İngilizce"];

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? memberId)
    {
        var access = await members.ResolvePlanAsync(memberId, write: false);
        if (access.Error != null) return access.Error;
        var owner = access.Owner!;

        var subjects = await db.Subjects.AsNoTracking().Where(s => s.MemberId == owner.Id).OrderBy(s => s.Id).ToListAsync();
        if (subjects.Count == 0)
        {
            // Liste boşsa varsayılan dersler eklenir (sistem tarafından, ekleyen boş).
            var now = DateTime.UtcNow;
            subjects = DefaultSubjects.Select(n => new Subject { MemberId = owner.Id, Name = n, CreatedAt = now }).ToList();
            db.Subjects.AddRange(subjects);
            await db.SaveChangesAsync();
        }

        var audit = await AuditLookup.LoadAsync(db, owner.FamilyId, subjects);
        return Ok(new SubjectListDto(owner.Id, access.CanEdit, subjects.Select(s => Map(s, audit)).ToList()));
    }

    // Gövde geriye dönük uyumluluk için düz JSON metnidir: "Ders adı"
    [HttpPost]
    public async Task<IActionResult> Add([FromQuery] int? memberId, [FromBody] string name)
    {
        name = (name ?? "").Trim();
        if (string.IsNullOrEmpty(name)) return Err.BadRequest("validation", "Ders adı boş olamaz.");
        if (name.Length > 100) return Err.BadRequest("validation", "Ders adı en fazla 100 karakter olabilir.");
        var access = await members.ResolvePlanAsync(memberId, write: true);
        if (access.Error != null) return access.Error;
        var owner = access.Owner!;

        // Türkçe kurallarıyla büyük/küçük harf duyarsız karşılaştırma (ör. "İngilizce" = "ingilizce")
        var existing = await db.Subjects.Where(s => s.MemberId == owner.Id).Select(s => s.Name).ToListAsync();
        if (existing.Any(n => TurkishIgnoreCase.Equals(n.Trim(), name)))
            return Err.Conflict("duplicate_subject", $"\"{name}\" zaten ders listesinde var.");
        var subject = new Subject { MemberId = owner.Id, Name = name, CreatedByMemberId = access.Current!.Id, CreatedAt = DateTime.UtcNow };
        db.Subjects.Add(subject);
        await db.SaveChangesAsync();
        var audit = await AuditLookup.LoadAsync(db, owner.FamilyId, [subject]);
        return Ok(Map(subject, audit));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var current = await members.GetCurrentAsync();
        if (current == null) return Err.FamilyRequired();
        var subject = await db.Subjects.FirstOrDefaultAsync(s => s.Id == id);
        if (subject == null) return Err.NotFound();
        var access = await members.ResolvePlanAsync(subject.MemberId, write: true);
        if (access.Error is ObjectResult { StatusCode: 404 }) return Err.NotFound();
        if (access.Error != null) return access.Error;
        db.Subjects.Remove(subject);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static SubjectDto Map(Subject s, AuditLookup a) =>
        new(s.Id, s.Name, a.Get(s.CreatedByMemberId), s.CreatedAt, a.Get(s.UpdatedByMemberId), s.UpdatedAt, s.IsImported);
}
