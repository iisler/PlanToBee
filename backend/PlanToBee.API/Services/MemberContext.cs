using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PlanToBee.API.Data;
using PlanToBee.API.Infrastructure;
using PlanToBee.API.Models;

namespace PlanToBee.API.Services;

// İstek sahibinin hesabını, ailesini ve seçili profilini her istekte veritabanından çözer.
// Aile tek hesapla giriş yapar; erişim belirtecindeki "mid" bu cihazda seçilmiş profildir.
// Profil silinir ya da rolü değişirse açık oturumlar bunu hemen görür.
public class MemberContext(AppDbContext db, IHttpContextAccessor http)
{
    private FamilyMember? _owner;
    private bool _ownerLoaded;
    private FamilyMember? _current;
    private bool _currentLoaded;

    public string UserId =>
        http.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("Kimliği doğrulanmış kullanıcı yok");

    // Hesap sahibinin profili: hesabın ailesini belirler. Hesabın ailesi yoksa null.
    public async Task<FamilyMember?> GetOwnerAsync()
    {
        if (_ownerLoaded) return _owner;
        _owner = await db.FamilyMembers
            .Include(m => m.Family)
            .FirstOrDefaultAsync(m => m.UserId == UserId && m.Status == MemberStatus.Active);
        _ownerLoaded = true;
        return _owner;
    }

    // Bu oturumda seçili profil. Profil seçilmemişse, silinmişse ya da başka aileye aitse null.
    public async Task<FamilyMember?> GetCurrentAsync()
    {
        if (_currentLoaded) return _current;
        _currentLoaded = true;
        var owner = await GetOwnerAsync();
        var raw = http.HttpContext?.User.FindFirstValue(AuthClaims.Member);
        if (owner == null || !int.TryParse(raw, out var memberId)) return null;
        _current = memberId == owner.Id ? owner : await db.FamilyMembers
            .Include(m => m.Family)
            .FirstOrDefaultAsync(m => m.Id == memberId && m.FamilyId == owner.FamilyId && m.Status == MemberStatus.Active);
        return _current;
    }

    // GetCurrentAsync null döndüğünde istemciye gidecek hata: aile yoksa family_required, profil seçilmemişse profile_required.
    public async Task<IActionResult> MissingAsync() =>
        await GetOwnerAsync() == null ? Err.FamilyRequired() : Err.ProfileRequired();

    // Yetki kuralı (sunucu tarafında zorunlu). Plan ailenin ortak planıdır:
    // - Ailedeki her profil plana kayıt ekleyebilir.
    // - Ebeveyn profili ailedeki tüm kayıtları düzenleyip silebilir.
    // - Çocuk profili yalnızca kendi eklediği kayıtları düzenleyip silebilir.
    public static bool CanEdit(FamilyMember current, AuditedEntity entry) =>
        current.Role == FamilyRole.Parent || entry.CreatedByMemberId == current.Id;
}
