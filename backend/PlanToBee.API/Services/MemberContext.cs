using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using PlanToBee.API.Data;
using PlanToBee.API.Models;

namespace PlanToBee.API.Services;

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

    // Yetki kuralı (sunucu tarafında zorunlu). Plan ailenin ortak planıdır:
    // - Ailedeki herkes plana kayıt ekleyebilir.
    // - Ebeveyn ailedeki tüm kayıtları düzenleyip silebilir.
    // - Çocuk yalnızca kendi eklediği kayıtları düzenleyip silebilir.
    public static bool CanEdit(FamilyMember current, AuditedEntity entry) =>
        current.Role == FamilyRole.Parent || entry.CreatedByMemberId == current.Id;
}
