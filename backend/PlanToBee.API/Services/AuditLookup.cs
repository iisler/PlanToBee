using Microsoft.EntityFrameworkCore;
using PlanToBee.API.Data;
using PlanToBee.API.DTOs;
using PlanToBee.API.Models;

namespace PlanToBee.API.Services;

// Kayıtlardaki ekleyen/düzenleyen üye kimliklerini görünen ada çevirir.
// Profil silinmişse ya da başka bir aileye aitse "eski üye" olarak işaretlenir.
public class AuditLookup(Dictionary<int, AuditMemberDto> map)
{
    public AuditMemberDto? Get(int? memberId) =>
        memberId != null && map.TryGetValue(memberId.Value, out var m) ? m : null;

    // known: istek sahibi gibi zaten yüklenmiş, plan ailesinin aktif üyesi. Kayıtlarda yalnızca o geçiyorsa
    // (yeni eklenen / az önce düzenlenen kayıt) veritabanına ayrıca gidilmez.
    public static async Task<AuditLookup> LoadAsync(AppDbContext db, int planFamilyId, IEnumerable<AuditedEntity> entities,
        FamilyMember? known = null)
    {
        var map = new Dictionary<int, AuditMemberDto>();
        if (known != null && known.FamilyId == planFamilyId && known.Status == MemberStatus.Active)
            map[known.Id] = new AuditMemberDto(known.Id, known.DisplayName, false);

        var ids = entities
            .SelectMany(e => new[] { e.CreatedByMemberId, e.UpdatedByMemberId })
            .Where(id => id != null).Select(id => id!.Value)
            .Where(id => !map.ContainsKey(id))
            .Distinct().ToList();
        if (ids.Count == 0) return new AuditLookup(map);

        var rows = await db.FamilyMembers.AsNoTracking()
            .Where(m => ids.Contains(m.Id))
            .Select(m => new { m.Id, m.DisplayName, m.Status, m.FamilyId })
            .ToListAsync();
        foreach (var r in rows)
            map[r.Id] = new AuditMemberDto(r.Id, r.DisplayName, r.Status == MemberStatus.Left || r.FamilyId != planFamilyId);
        return new AuditLookup(map);
    }
}
