using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PlanToBee.API.Data;
using PlanToBee.API.Infrastructure;
using PlanToBee.API.Models;

namespace PlanToBee.API.Services;

// Plan erişim kontrolünün sonucu. Error doluysa istek reddedilir.
public record PlanAccess(FamilyMember? Current, FamilyMember? Owner, bool CanEdit, IActionResult? Error)
{
    public static PlanAccess Fail(IActionResult error) => new(null, null, false, error);
}

// İstek sahibinin aile üyeliğini ve plan yetkilerini her istekte veritabanından çözer.
// Böylece aileden çıkarılan kullanıcının açık oturumu aile verisine hemen erişemez
// ve rol değişikliği anında etkili olur.
public class MemberContext(AppDbContext db, IHttpContextAccessor http)
{
    private FamilyMember? _current;
    private bool _loaded;

    public string UserId =>
        http.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("Kimliği doğrulanmış kullanıcı yok");

    public async Task<FamilyMember?> GetCurrentAsync()
    {
        if (_loaded) return _current;
        _current = await db.FamilyMembers
            .Include(m => m.Family)
            .FirstOrDefaultAsync(m => m.UserId == UserId && m.Status == MemberStatus.Joined);
        _loaded = true;
        return _current;
    }

    // Yetki kuralı (sunucu tarafında zorunlu):
    // - Ebeveyn ailedeki tüm planlara yazabilir.
    // - Çocuk yalnızca kendi planına yazabilir.
    // - Kaydı kimin eklediği yetkiyi etkilemez.
    public static bool CanEdit(FamilyMember current, FamilyMember owner) =>
        current.FamilyId == owner.FamilyId &&
        owner.Status != MemberStatus.Left &&
        (current.Role == FamilyRole.Parent || current.Id == owner.Id);

    // memberId verilmezse istek sahibinin kendi planı kullanılır.
    // Başka ailenin (veya ayrılmış üyenin) planı 404 döner, varlığı belli edilmez.
    public async Task<PlanAccess> ResolvePlanAsync(int? memberId, bool write)
    {
        var current = await GetCurrentAsync();
        if (current == null) return PlanAccess.Fail(Err.FamilyRequired());

        FamilyMember? owner = current;
        if (memberId != null && memberId != current.Id)
        {
            owner = await db.FamilyMembers.FirstOrDefaultAsync(m =>
                m.Id == memberId && m.FamilyId == current.FamilyId && m.Status != MemberStatus.Left);
            if (owner == null) return PlanAccess.Fail(Err.NotFound("plan_not_found", "Plan bulunamadı."));
        }

        var canEdit = CanEdit(current, owner);
        if (write && !canEdit) return PlanAccess.Fail(Err.ReadOnly());
        return new PlanAccess(current, owner, canEdit, null);
    }
}
