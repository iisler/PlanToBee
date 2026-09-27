using Microsoft.EntityFrameworkCore;
using PlanToBee.API.Data;
using PlanToBee.API.DTOs;
using PlanToBee.API.Models;

namespace PlanToBee.API.Services;

// Kayıtlardaki ekleyen/düzenleyen üye kimliklerini görünen ada çevirir.
// Üye ayrılmışsa veya başka bir aileye aitse (plan taşınmış) "eski üye" olarak işaretlenir.
public class AuditLookup(Dictionary<int, AuditMemberDto> map)
{
    public AuditMemberDto? Get(int? memberId) =>
        memberId != null && map.TryGetValue(memberId.Value, out var m) ? m : null;

    public static async Task<AuditLookup> LoadAsync(AppDbContext db, int planFamilyId, IEnumerable<AuditedEntity> entities)
    {
        var ids = entities
            .SelectMany(e => new[] { e.CreatedByMemberId, e.UpdatedByMemberId })
            .Where(id => id != null).Select(id => id!.Value).Distinct().ToList();
        if (ids.Count == 0) return new AuditLookup([]);

        var rows = await db.FamilyMembers.AsNoTracking()
            .Where(m => ids.Contains(m.Id))
            .Select(m => new { m.Id, m.DisplayName, m.Status, m.FamilyId })
            .ToListAsync();
        return new AuditLookup(rows.ToDictionary(
            r => r.Id,
            r => new AuditMemberDto(r.Id, r.DisplayName, r.Status == MemberStatus.Left || r.FamilyId != planFamilyId)));
    }
}
