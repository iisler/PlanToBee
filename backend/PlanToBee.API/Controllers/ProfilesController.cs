using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using PlanToBee.API.Data;
using PlanToBee.API.DTOs;
using PlanToBee.API.Infrastructure;
using PlanToBee.API.Models;
using PlanToBee.API.Services;

namespace PlanToBee.API.Controllers;

// Netflix tarzı profiller. Aile tek hesapla giriş yapar; cihazda profil seçilir ("Kim kullanıyor?").
// - Profil listesi ve seçimi için yalnızca hesabın oturumu yeterlidir (profil seçilmiş olması gerekmez).
// - Profil ekleme, düzenleme ve silme yalnızca ebeveyn profilinden yapılır.
// - Ailede birden fazla profil varsa ebeveyn profillerinde PIN zorunludur; çocuklarda isteğe bağlıdır.
//   Tek profilli aile (tek başına kullanım) PIN'siz çalışır. 5 hatalı PIN denemesinde profil 5 dk kilitlenir.
[ApiController]
[Route("api/profiles")]
[Authorize]
[RequireVerifiedEmail]
[EnableRateLimiting(RateLimitPolicies.Api)]
public class ProfilesController(
    AppDbContext db,
    UserManager<User> userManager,
    MemberContext members,
    AuthTokenService tokens) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var owner = await members.GetOwnerAsync();
        if (owner == null) return Err.FamilyRequired();
        var current = await members.GetCurrentAsync();
        return Ok(await FamilyController.ListProfiles(db, owner.FamilyId, current?.Id));
    }

    [HttpPost("{id:int}/select")]
    [EnableRateLimiting(RateLimitPolicies.Pin)]
    public async Task<IActionResult> Select(int id, SelectProfileDto dto)
    {
        var owner = await members.GetOwnerAsync();
        if (owner == null) return Err.FamilyRequired();
        var profile = await ActiveProfile(owner.FamilyId, id);
        if (profile == null) return Err.NotFound("profile_not_found", "Profil bulunamadı.");
        var user = await userManager.GetUserAsync(User);
        if (user == null) return Unauthorized();

        var now = DateTime.UtcNow;
        if (profile.PinHash != null)
        {
            var result = PinService.Verify(profile, dto.Pin, now, out var remaining);
            await db.SaveChangesAsync(); // deneme sayacı / kilit
            if (result == PinService.Result.Locked) return PinLocked(remaining);
            // 401 değil: oturum geçerli, yalnızca PIN yanlış (istemci 401'i oturum sonu sayar).
            if (result == PinService.Result.Wrong) return Err.BadRequest("pin_invalid", "PIN hatalı.");
        }
        else if (profile.Role == FamilyRole.Parent &&
                 await db.FamilyMembers.CountAsync(m => m.FamilyId == owner.FamilyId && m.Status == MemberStatus.Active) > 1)
        {
            // Eski kayıtlarda PIN'siz ebeveyn profili olabilir. PIN'i yalnızca hesap şifresini bilen belirleyebilir;
            // aksi halde aile şifresini bilen bir çocuk ebeveyn profiline kendi PIN'ini koyabilirdi.
            if (dto.Password == null || dto.NewPin == null)
                return Err.Conflict("pin_setup_required", "Bu ebeveyn profili için PIN belirlemelisin. Hesap şifreni ve yeni PIN'i gir.");
            if (!PinService.IsValidFormat(dto.NewPin)) return Err.BadRequest("validation", "PIN 4 rakamdan oluşmalı.");
            if (!await userManager.CheckPasswordAsync(user, dto.Password))
                return Err.BadRequest("invalid_credentials", "Hesap şifresi hatalı.");
            profile.PinHash = PinService.Hash(profile, dto.NewPin);
            await db.SaveChangesAsync();
        }

        if (dto.RefreshToken != null) await tokens.RevokeAsync(dto.RefreshToken);
        return Ok(await tokens.BuildAuthResponse(user, profile.Id));
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateProfileDto dto)
    {
        var (me, error) = await RequireParent();
        if (error != null) return error;
        var name = dto.DisplayName.Trim();
        if (name.Length == 0) return Err.BadRequest("validation", "Ad girin.");
        var role = dto.Role!.Value;
        if (!Enum.IsDefined(role)) return Err.BadRequest("validation", "Geçersiz rol.");
        var pinError = CheckNewPin(dto.Pin, required: role == FamilyRole.Parent);
        if (pinError != null) return pinError;
        // Tek başına kullanımdan aileye geçiş: profili ekleyen ebeveynin PIN'i yoksa önce o belirlenir.
        if (me!.PinHash == null)
        {
            if (dto.MyPin == null)
                return Err.BadRequest("my_pin_required", "Ailene profil eklemeden önce kendi profilin için 4 haneli PIN belirle.");
            if (!PinService.IsValidFormat(dto.MyPin)) return Err.BadRequest("validation", "PIN 4 rakamdan oluşmalı.");
        }
        if (await NameTaken(me.FamilyId, name, null))
            return Err.Conflict("duplicate_profile", $"\"{name}\" adlı bir profil zaten var.");
        if (me.PinHash == null) me.PinHash = PinService.Hash(me, dto.MyPin!);

        var profile = new FamilyMember
        {
            FamilyId = me.FamilyId,
            DisplayName = FamilyService.Truncate(name, 50),
            Role = role,
            Status = MemberStatus.Active,
            CreatedAt = DateTime.UtcNow,
        };
        if (dto.Pin != null) profile.PinHash = PinService.Hash(profile, dto.Pin);
        db.FamilyMembers.Add(profile);
        await db.SaveChangesAsync();
        return Ok(FamilyController.ToDto(profile, me.Id, DateTime.UtcNow));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateProfileDto dto)
    {
        var (me, error) = await RequireParent();
        if (error != null) return error;
        var profile = await ActiveProfile(me!.FamilyId, id);
        if (profile == null) return Err.NotFound("profile_not_found", "Profil bulunamadı.");
        var name = dto.DisplayName.Trim();
        if (name.Length == 0) return Err.BadRequest("validation", "Ad girin.");
        var role = dto.Role!.Value;
        if (!Enum.IsDefined(role)) return Err.BadRequest("validation", "Geçersiz rol.");
        if (profile.IsAdmin && role != FamilyRole.Parent)
            return Err.BadRequest("owner_must_be_parent", "Hesap sahibinin profili Ebeveyn rolünde kalmalı.");
        if (profile.Id == me.Id && role != FamilyRole.Parent)
            return Err.BadRequest("self_demote", "Kendi profilini Çocuk yapamazsın. Başka bir ebeveyn profilinden değiştir.");
        if (role == FamilyRole.Parent && profile.PinHash == null)
        {
            var pinError = CheckNewPin(dto.Pin, required: true);
            if (pinError != null) return pinError;
            profile.PinHash = PinService.Hash(profile, dto.Pin!);
        }
        if (await NameTaken(me.FamilyId, name, profile.Id))
            return Err.Conflict("duplicate_profile", $"\"{name}\" adlı bir profil zaten var.");

        profile.DisplayName = FamilyService.Truncate(name, 50);
        profile.Role = role; // yetki kontrolleri her istekte veritabanından okunduğu için anında etkili olur
        await db.SaveChangesAsync();
        return Ok(FamilyController.ToDto(profile, me.Id, DateTime.UtcNow));
    }

    // Ebeveyn her profilin PIN'ini değiştirebilir; çocuk yalnızca kendi PIN'ini. Ebeveyn profillerinde PIN kaldırılamaz.
    [HttpPut("{id:int}/pin")]
    public async Task<IActionResult> SetPin(int id, SetPinDto dto)
    {
        var me = await members.GetCurrentAsync();
        if (me == null) return await members.MissingAsync();
        if (me.Role != FamilyRole.Parent && me.Id != id) return Err.ParentOnly();
        var profile = await ActiveProfile(me.FamilyId, id);
        if (profile == null) return Err.NotFound("profile_not_found", "Profil bulunamadı.");
        var pinError = CheckNewPin(dto.Pin, required: profile.Role == FamilyRole.Parent);
        if (pinError != null) return pinError;

        profile.PinHash = dto.Pin == null ? null : PinService.Hash(profile, dto.Pin);
        profile.FailedPinAttempts = 0;
        profile.PinLockedUntil = null;
        await db.SaveChangesAsync();
        return Ok(FamilyController.ToDto(profile, me.Id, DateTime.UtcNow));
    }

    // Profil "Eski üye" olarak kalır; eklediği kayıtlar ailenin planında durur. Bu profili kullanan cihazlar
    // bir sonraki istekte profil seçme ekranına döner.
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var (me, error) = await RequireParent();
        if (error != null) return error;
        var profile = await ActiveProfile(me!.FamilyId, id);
        if (profile == null) return Err.NotFound("profile_not_found", "Profil bulunamadı.");
        if (profile.IsAdmin) return Err.BadRequest("owner_cannot_be_removed", "Hesap sahibinin profili silinemez.");
        if (profile.Id == me.Id) return Err.BadRequest("self_remove", "Kullandığın profili silemezsin. Başka bir ebeveyn profilinden sil.");

        FamilyService.MarkLeft(profile);
        await db.SaveChangesAsync();
        await db.RefreshTokens.Where(t => t.MemberId == profile.Id && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.MemberId, (int?)null));
        // Silinen profile bildirim gitmez: cihaz abonelikleri, ayarları ve bekleyen bildirimleri silinir.
        await db.PushSubscriptions.Where(p => p.MemberId == profile.Id).ExecuteDeleteAsync();
        await db.NotificationPreferences.Where(p => p.MemberId == profile.Id).ExecuteDeleteAsync();
        await db.PendingNotifications.Where(p => p.RecipientMemberId == profile.Id).ExecuteDeleteAsync();
        return NoContent();
    }

    private Task<FamilyMember?> ActiveProfile(int familyId, int id) =>
        db.FamilyMembers.FirstOrDefaultAsync(m => m.Id == id && m.FamilyId == familyId && m.Status == MemberStatus.Active);

    private async Task<bool> NameTaken(int familyId, string name, int? exceptId)
    {
        var names = await db.FamilyMembers
            .Where(m => m.FamilyId == familyId && m.Status == MemberStatus.Active && m.Id != exceptId)
            .Select(m => m.DisplayName).ToListAsync();
        var tr = new System.Globalization.CultureInfo("tr-TR");
        return names.Any(n => string.Compare(n.Trim(), name, tr, System.Globalization.CompareOptions.IgnoreCase) == 0);
    }

    private static ObjectResult? CheckNewPin(string? pin, bool required)
    {
        if (pin == null)
            return required ? Err.BadRequest("pin_required", "Ebeveyn profilleri için 4 haneli PIN zorunlu.") : null;
        return PinService.IsValidFormat(pin) ? null : Err.BadRequest("validation", "PIN 4 rakamdan oluşmalı.");
    }

    private static ObjectResult PinLocked(TimeSpan remaining) =>
        Err.Make(429, "pin_locked",
            $"Çok fazla hatalı PIN denemesi. Profil {Math.Max(1, (int)Math.Ceiling(remaining.TotalMinutes))} dakika kilitli.");

    private async Task<(FamilyMember? Me, IActionResult? Error)> RequireParent()
    {
        var me = await members.GetCurrentAsync();
        if (me == null) return (null, await members.MissingAsync());
        if (me.Role != FamilyRole.Parent) return (null, Err.ParentOnly());
        return (me, null);
    }
}
