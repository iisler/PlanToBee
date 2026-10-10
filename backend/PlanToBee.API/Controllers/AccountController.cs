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

// Hesap işlemleri. [RequireVerifiedEmail] yok: mağaza kuralı gereği giriş yapabilen her hesap (e-postası
// doğrulanmamış olsa da) kendini silebilmelidir.
[ApiController]
[Route("api/account")]
[Authorize]
// Gövdede şifre var: kaba kuvvet denemesine karşı giriş ile aynı IP sınırı.
[EnableRateLimiting(RateLimitPolicies.Auth)]
public class AccountController(
    AppDbContext db,
    UserManager<User> userManager,
    SignInManager<User> signInManager,
    MemberContext members,
    ILogger<AccountController> logger) : ControllerBase
{
    public const string ConfirmText = "SİL";

    // Hesabı ve ailenin bütün verisini kalıcı olarak siler. Hedef her zaman oturumun kendi hesabıdır (gövdede kimlik yok).
    // DELETE yerine POST: gövde (şifre) taşıyan DELETE isteklerinin anlamı tanımsızdır, bazı proxy'ler gövdeyi atar.
    // Kontrol sırası: profil yetkisi (403) → onay metni (400) → şifre (400/429, hatalı deneme kilit sayacına yazılır).
    [HttpPost("delete")]
    public async Task<IActionResult> Delete(DeleteAccountDto dto)
    {
        var user = await userManager.GetUserAsync(User);
        if (user == null) return Unauthorized();

        // Ailesi olan hesapta yalnızca hesap sahibinin profili silebilir. Ailesi olmayan hesap (aile kurmamış ya da
        // e-postası doğrulanmamış) profil seçmeden silebilir.
        var owner = await members.GetOwnerAsync();
        if (owner != null)
        {
            var current = await members.GetCurrentAsync();
            if (current == null) return Err.ProfileRequired();
            if (current.Id != owner.Id)
                return Err.Forbidden("owner_only", "Hesabı yalnızca hesap sahibi kendi profilinden silebilir.");
        }

        if ((dto.Confirm ?? "").Trim() != ConfirmText)
            return Err.BadRequest("confirm_invalid", $"Onaylamak için {ConfirmText} yaz.");

        var check = await signInManager.CheckPasswordSignInAsync(user, dto.Password ?? "", lockoutOnFailure: true);
        if (check.IsLockedOut)
            return Err.Make(429, "locked_out", "Çok fazla hatalı şifre denemesi. Birkaç dakika sonra tekrar dene.");
        // 401 değil: oturum geçerli, yalnızca şifre yanlış (istemci 401'i oturum sonu sayar).
        if (!check.Succeeded) return Err.BadRequest("password_invalid", "Şifre hatalı.");

        var userId = user.Id;
        var familyId = owner?.FamilyId;
        await using var tx = await db.Database.BeginTransactionAsync();
        // Aynı hesap için eşzamanlı iki silme isteği: ikincisi birincinin bitmesini bekler, hesabı bulamaz.
        var locked = await db.Database
            .SqlQuery<int>($"SELECT 1 AS \"Value\" FROM \"Users\" WHERE \"Id\" = {userId} FOR UPDATE")
            .ToListAsync();
        if (locked.Count == 0) return NoContent();

        if (familyId is int fid)
        {
            // Satırlar açıkça, bağımlıdan üste doğru silinir; veritabanındaki cascade'ler yalnızca bu sırada
            // eşzamanlı eklenen satırlar için güvencedir. Kayıt izleri (CreatedBy/UpdatedBy) SetNull olduğundan
            // önce kayıtlar, sonra profiller silinir.
            await db.StudyEntries.Where(e => e.Day!.FamilyId == fid).ExecuteDeleteAsync();
            await db.Events.Where(e => e.Day!.FamilyId == fid).ExecuteDeleteAsync();
            await db.TrainingEntries.Where(e => e.Day!.FamilyId == fid).ExecuteDeleteAsync();
            await db.Days.Where(d => d.FamilyId == fid).ExecuteDeleteAsync();
            await db.Subjects.Where(s => s.FamilyId == fid).ExecuteDeleteAsync();
            await db.PendingNotifications.Where(p => p.FamilyId == fid).ExecuteDeleteAsync();
            await db.PushSubscriptions.Where(p => p.FamilyId == fid || p.Member!.FamilyId == fid).ExecuteDeleteAsync();
            await db.NotificationPreferences.Where(p => p.Member!.FamilyId == fid).ExecuteDeleteAsync();
        }
        await db.RefreshTokens.Where(t => t.UserId == userId).ExecuteDeleteAsync();
        if (familyId is int f)
        {
            await db.FamilyMembers.Where(m => m.FamilyId == f).ExecuteDeleteAsync();
            await db.Families.Where(x => x.Id == f).ExecuteDeleteAsync();
        }

        // İzlenen varlıklar (sahip profili, aile) artık veritabanında yok. Temizlenmezse EF, kullanıcı silinirken
        // FamilyMembers.UserId için SetNull güncellemesi üretir ve 0 satır etkilendiği için hata verir.
        db.ChangeTracker.Clear();
        var fresh = await userManager.FindByIdAsync(userId);
        // UserClaims/UserLogins/UserTokens/UserRoles veritabanında Users'a cascade ile bağlıdır.
        var result = fresh == null ? IdentityResult.Success : await userManager.DeleteAsync(fresh);
        if (!result.Succeeded)
        {
            await tx.RollbackAsync();
            logger.LogError("Hesap silinemedi (Identity hatası). UserId={UserId} Codes={Codes}",
                userId, string.Join(",", result.Errors.Select(e => e.Code)));
            return Err.Make(500, "server_error", "Hesap silinemedi. Biraz sonra tekrar dene.");
        }
        await tx.CommitAsync();

        logger.LogInformation("Hesap silindi. UserId={UserId} FamilyId={FamilyId}", userId, familyId);
        return NoContent();
    }
}
