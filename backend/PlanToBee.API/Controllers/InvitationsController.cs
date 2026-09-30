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

// Davet edilen kişinin kullandığı uç noktalar (link belirteci veya e-posta + 6 haneli kod ile).
[ApiController]
[Route("api/invitations")]
[EnableRateLimiting(RateLimitPolicies.InvitePublic)]
public class InvitationsController(
    AppDbContext db,
    UserManager<User> userManager,
    InvitationService invitations,
    FamilyService families,
    MemberContext members,
    AuthTokenService tokens) : ControllerBase
{
    // Davet önizlemesi: aile adı, görünen ad, e-posta. Daveti tüketmez.
    [HttpPost("resolve")]
    public async Task<IActionResult> Resolve(InviteCredentialsDto dto)
    {
        var (inv, error) = await invitations.ResolveAsync(dto.Token, dto.Email, dto.Code);
        if (error != null) return error;
        var accountExists = await userManager.FindByEmailAsync(inv!.Email) != null;
        return Ok(new InvitationPreviewDto(
            inv.Family!.Name, inv.Member!.DisplayName, inv.Member.Role.ToString(), inv.Email,
            inv.InvitedBy?.DisplayName, inv.ExpiresAt, accountExists));
    }

    // Davetle yeni hesap: e-posta davetten gelir (değiştirilemez), yalnızca şifre belirlenir.
    // E-posta doğrulanmış sayılır ve otomatik giriş için token döner.
    [HttpPost("accept-new")]
    public async Task<IActionResult> AcceptNew(AcceptNewDto dto)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        var (inv, error) = await invitations.ResolveAsync(dto.Token, dto.Email, dto.Code);
        if (error != null) { await tx.CommitAsync(); return error; } // hatalı kod sayacı kalıcı olsun
        if (await userManager.FindByEmailAsync(inv!.Email) != null)
            return Err.Conflict("account_exists", "Bu e-posta adresiyle zaten bir PlanToBee hesabı var. Giriş yapıp daveti kabul et.");

        var member = inv.Member!;
        var user = new User { UserName = inv.Email, Email = inv.Email, DisplayName = member.DisplayName, EmailConfirmed = true };
        var result = await userManager.CreateAsync(user, dto.Password);
        if (!result.Succeeded)
        {
            var messages = result.Errors.Select(e => e.Description).ToList();
            return Err.BadRequest("validation", string.Join(" ", messages), messages);
        }

        // Hesapsız profil veya bekleyen üye bu hesaba bağlanır; ailenin ortak planını kullanır.
        var now = DateTime.UtcNow;
        member.UserId = user.Id;
        member.Status = MemberStatus.Joined;
        member.JoinedAt = now;
        inv.Status = InvitationStatus.Accepted;
        inv.AcceptedAt = now;
        try
        {
            await db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch (DbUpdateException)
        {
            return Err.Gone("invite_used", "Bu davet az önce kullanıldı. Hesabın varsa giriş yap.");
        }
        return Ok(await tokens.BuildAuthResponse(user));
    }

    // Davetle mevcut hesap: kullanıcı önce giriş yapar. Oturumdaki e-posta davetin adresiyle eşleşmeli.
    // Kullanıcının başka üyesi olmayan tek kişilik ailesi varsa o ailenin planı yeni aileye birleştirilir.
    [HttpPost("accept-existing")]
    [Authorize]
    public async Task<IActionResult> AcceptExisting(InviteCredentialsDto dto)
    {
        var user = await userManager.GetUserAsync(User);
        if (user == null) return Unauthorized();

        await using var tx = await db.Database.BeginTransactionAsync();
        var (inv, error) = await invitations.ResolveAsync(dto.Token, dto.Email, dto.Code);
        if (error != null) { await tx.CommitAsync(); return error; }
        if (!string.Equals(user.NormalizedEmail, inv!.NormalizedEmail, StringComparison.Ordinal))
            return Err.Forbidden("invite_email_mismatch", "Bu davet başka bir e-posta adresine gönderilmiş. Davetin gönderildiği hesapla giriş yap.");

        var current = await members.GetCurrentAsync();
        if (current != null)
        {
            if (current.FamilyId == inv.FamilyId)
                return Err.Conflict("already_member", "Zaten bu ailenin üyesisin.");
            var others = await db.FamilyMembers.AnyAsync(m =>
                m.FamilyId == current.FamilyId && m.Id != current.Id && m.Status != MemberStatus.Left);
            if (others)
                return Err.Conflict("family_not_empty",
                    "Şu an başka üyeleri olan bir ailedesin. Yeni aileye katılmak için önce mevcut ailenden ayrılmalısın (yöneticiysen önce yöneticiliği devret).");
        }

        var target = inv.Member!;
        var now = DateTime.UtcNow;
        if (current != null)
        {
            FamilyService.MarkLeft(current);
            await db.SaveChangesAsync(); // benzersiz UserId indeksi için önce eski bağ kaldırılır
            // Eski ailede başka üye kalmadı (yukarıda kontrol edildi): planı yeni aileye birleşir.
            await families.MergeFamilyPlanAsync(current.FamilyId, target.FamilyId, current.Id, target.Id);
        }

        target.UserId = user.Id;
        target.Status = MemberStatus.Joined;
        target.JoinedAt = now;
        inv.Status = InvitationStatus.Accepted;
        inv.AcceptedAt = now;
        if (!user.EmailConfirmed) user.EmailConfirmed = true; // davet bu adrese gitti
        try
        {
            await db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch (DbUpdateException)
        {
            return Err.Gone("invite_used", "Bu davet az önce kullanıldı.");
        }
        return Ok(await tokens.BuildAuthResponse(user));
    }
}
