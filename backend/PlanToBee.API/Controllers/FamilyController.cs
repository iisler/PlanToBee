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

public record InviteResultDto(FamilyMemberDto Member, bool EmailSent);

[ApiController]
[Route("api/family")]
[Authorize]
[RequireVerifiedEmail]
public class FamilyController(
    AppDbContext db,
    UserManager<User> userManager,
    MemberContext members,
    FamilyService families,
    InvitationService invitations,
    SendThrottle throttle,
    ILogger<FamilyController> logger) : ControllerBase
{
    // ---------- Aile ----------

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var me = await members.GetCurrentAsync();
        if (me == null) return Err.FamilyRequired();
        return Ok(await BuildFamilyDto(me));
    }

    [HttpPost]
    public async Task<IActionResult> Create(FamilyNameDto dto)
    {
        var name = dto.Name.Trim();
        if (name.Length == 0) return Err.BadRequest("validation", "Aile adı girin.");
        if (await members.GetCurrentAsync() != null)
            return Err.Conflict("already_in_family", "Zaten bir ailenin üyesisin. Bir kullanıcı aynı anda yalnızca bir aileye üye olabilir.");

        var user = await userManager.GetUserAsync(User);
        if (user == null) return Unauthorized();
        try
        {
            var me = await families.CreateFamilyAsync(user, name);
            me.Family = await db.Families.FindAsync(me.FamilyId);
            return Ok(await BuildFamilyDto(me));
        }
        catch (DbUpdateException)
        {
            // Eşzamanlı iki oluşturma isteği: benzersiz UserId indeksi ikincisini reddeder.
            return Err.Conflict("already_in_family", "Zaten bir ailenin üyesisin.");
        }
    }

    [HttpPut]
    public async Task<IActionResult> Rename(FamilyNameDto dto)
    {
        var (me, error) = await RequireAdmin();
        if (error != null) return error;
        var name = dto.Name.Trim();
        if (name.Length == 0) return Err.BadRequest("validation", "Aile adı girin.");
        me!.Family!.Name = name;
        await db.SaveChangesAsync();
        return Ok(await BuildFamilyDto(me));
    }

    // ---------- Davetler ----------

    [HttpGet("invitations")]
    public async Task<IActionResult> ListInvitations()
    {
        var (me, error) = await RequireAdmin();
        if (error != null) return error;
        var list = await db.Invitations
            .Include(i => i.Member).Include(i => i.InvitedBy)
            .Where(i => i.FamilyId == me!.FamilyId)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync();
        var now = DateTime.UtcNow;
        return Ok(list.Select(i => ToDto(i, now)));
    }

    [HttpPost("invitations")]
    [EnableRateLimiting(RateLimitPolicies.InviteSend)]
    public async Task<IActionResult> Invite(InviteMemberDto dto)
    {
        var (me, error) = await RequireAdmin();
        if (error != null) return error;
        var displayName = dto.DisplayName.Trim();
        if (displayName.Length == 0) return Err.BadRequest("validation", "Ad girin.");
        var role = dto.Role!.Value;
        if (!Enum.IsDefined(role)) return Err.BadRequest("validation", "Geçersiz rol.");

        var emailError = await ValidateInviteEmail(me!, dto.Email);
        if (emailError != null) return emailError;
        if (!throttle.TryAcquire($"family-invite:{me!.FamilyId}", TimeSpan.FromDays(1), 30))
            return Err.TooMany("Bugün çok fazla davet gönderildi. Yarın tekrar dene.");

        await using var tx = await db.Database.BeginTransactionAsync();
        var now = DateTime.UtcNow;
        var member = new FamilyMember
        {
            FamilyId = me.FamilyId,
            DisplayName = displayName,
            Role = role,
            Status = MemberStatus.Invited,
            CreatedAt = now
        };
        db.FamilyMembers.Add(member);
        await db.SaveChangesAsync();
        var (inv, token, code) = await CreateInvitation(me, member, dto.Email);
        await tx.CommitAsync();

        var sent = await TrySend(inv, member, me, token, code);
        return Ok(new InviteResultDto(await MemberDto(me, member.Id), sent));
    }

    [HttpPost("invitations/{id:int}/resend")]
    [EnableRateLimiting(RateLimitPolicies.InviteSend)]
    public async Task<IActionResult> Resend(int id)
    {
        var (me, error) = await RequireAdmin();
        if (error != null) return error;
        var inv = await db.Invitations.Include(i => i.Member)
            .FirstOrDefaultAsync(i => i.Id == id && i.FamilyId == me!.FamilyId);
        if (inv == null || inv.Member == null) return Err.NotFound("invite_not_found", "Davet bulunamadı.");
        if (inv.Status != InvitationStatus.Pending)
            return Err.Conflict("invite_not_pending", "Yalnızca bekleyen veya süresi dolmuş davetler yeniden gönderilebilir.");
        if (DateTime.UtcNow - inv.LastSentAt < TimeSpan.FromSeconds(60))
            return Err.TooMany("Bu davet az önce gönderildi. Bir dakika bekleyip tekrar dene.");
        if (!throttle.TryAcquire($"family-invite:{me!.FamilyId}", TimeSpan.FromDays(1), 30))
            return Err.TooMany("Bugün çok fazla davet gönderildi. Yarın tekrar dene.");

        // Yeni link ve kod; eskileri anında geçersiz olur, süre yeniden 7 gün.
        var (token, code) = InvitationService.Rotate(inv);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateConcurrencyException) { return Err.Conflict("invite_changed", "Davet bu sırada değişti. Sayfayı yenileyip tekrar dene."); }

        var sent = await TrySend(inv, inv.Member, me, token, code);
        return Ok(new InviteResultDto(await MemberDto(me, inv.MemberId), sent));
    }

    [HttpPost("invitations/{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id)
    {
        var (me, error) = await RequireAdmin();
        if (error != null) return error;
        var inv = await db.Invitations.Include(i => i.Member)
            .FirstOrDefaultAsync(i => i.Id == id && i.FamilyId == me!.FamilyId);
        if (inv == null) return Err.NotFound("invite_not_found", "Davet bulunamadı.");
        if (inv.Status != InvitationStatus.Pending)
            return Err.Conflict("invite_not_pending", "Yalnızca bekleyen davetler iptal edilebilir.");

        inv.Status = InvitationStatus.Cancelled;
        inv.CancelledAt = DateTime.UtcNow;
        // Üye ve planı korunur; hesapsız profile döner. Yönetici yeniden davet edebilir ya da çıkarabilir.
        if (inv.Member is { Status: MemberStatus.Invited })
            inv.Member.Status = MemberStatus.NoAccount;
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateConcurrencyException) { return Err.Conflict("invite_changed", "Davet bu sırada değişti. Sayfayı yenileyip tekrar dene."); }
        return Ok(await MemberDto(me!, inv.MemberId));
    }

    // ---------- Üyeler ----------

    // E-postası olmayan çocuk için hesapsız profil (yalnızca yönetici).
    [HttpPost("members/profiles")]
    public async Task<IActionResult> CreateProfile(CreateProfileDto dto)
    {
        var (me, error) = await RequireAdmin();
        if (error != null) return error;
        var name = dto.DisplayName.Trim();
        if (name.Length == 0) return Err.BadRequest("validation", "Ad girin.");
        var member = new FamilyMember
        {
            FamilyId = me!.FamilyId,
            DisplayName = name,
            Role = FamilyRole.Child,
            Status = MemberStatus.NoAccount,
            CreatedAt = DateTime.UtcNow
        };
        db.FamilyMembers.Add(member);
        await db.SaveChangesAsync();
        return Ok(await MemberDto(me, member.Id));
    }

    // Hesapsız profile davet: kabul edilince mevcut plan yeni hesaba bağlanır.
    [HttpPost("members/{id:int}/invite")]
    [EnableRateLimiting(RateLimitPolicies.InviteSend)]
    public async Task<IActionResult> InviteProfile(int id, InviteProfileDto dto)
    {
        var (me, error) = await RequireAdmin();
        if (error != null) return error;
        var member = await db.FamilyMembers.FirstOrDefaultAsync(m => m.Id == id && m.FamilyId == me!.FamilyId && m.Status != MemberStatus.Left);
        if (member == null) return Err.NotFound("member_not_found", "Üye bulunamadı.");
        if (member.Status != MemberStatus.NoAccount)
            return Err.Conflict("member_has_account_or_invite", "Bu üyenin zaten hesabı ya da bekleyen bir daveti var.");

        var emailError = await ValidateInviteEmail(me!, dto.Email);
        if (emailError != null) return emailError;
        if (!throttle.TryAcquire($"family-invite:{me!.FamilyId}", TimeSpan.FromDays(1), 30))
            return Err.TooMany("Bugün çok fazla davet gönderildi. Yarın tekrar dene.");

        await using var tx = await db.Database.BeginTransactionAsync();
        member.Status = MemberStatus.Invited;
        var (inv, token, code) = await CreateInvitation(me, member, dto.Email);
        await tx.CommitAsync();

        var sent = await TrySend(inv, member, me, token, code);
        return Ok(new InviteResultDto(await MemberDto(me, member.Id), sent));
    }

    [HttpPut("members/{id:int}/role")]
    public async Task<IActionResult> ChangeRole(int id, ChangeRoleDto dto)
    {
        var (me, error) = await RequireAdmin();
        if (error != null) return error;
        var role = dto.Role!.Value;
        if (!Enum.IsDefined(role)) return Err.BadRequest("validation", "Geçersiz rol.");
        var member = await db.FamilyMembers.FirstOrDefaultAsync(m => m.Id == id && m.FamilyId == me!.FamilyId && m.Status != MemberStatus.Left);
        if (member == null) return Err.NotFound("member_not_found", "Üye bulunamadı.");
        if (member.IsAdmin && role != FamilyRole.Parent)
            return Err.BadRequest("admin_must_be_parent", "Yönetici Ebeveyn rolünde olmalı. Önce yöneticiliği devret.");

        member.Role = role; // yetki kontrolleri her istekte DB'den okunduğu için anında etkili olur
        await db.SaveChangesAsync();
        return Ok(await MemberDto(me!, member.Id));
    }

    // Hesabı olan üye: üye "Ayrıldı" olur, kişisel planı onunla birlikte yeni tek kişilik ailesine gider.
    // Hesapsız profil / daveti bekleyen üye: planıyla birlikte kalıcı olarak silinir.
    [HttpDelete("members/{id:int}")]
    public async Task<IActionResult> Remove(int id)
    {
        var (me, error) = await RequireAdmin();
        if (error != null) return error;
        var member = await db.FamilyMembers.FirstOrDefaultAsync(m => m.Id == id && m.FamilyId == me!.FamilyId && m.Status != MemberStatus.Left);
        if (member == null) return Err.NotFound("member_not_found", "Üye bulunamadı.");
        if (member.Id == me!.Id)
            return Err.BadRequest("admin_cannot_leave", "Yönetici kendini aileden çıkaramaz. Önce yöneticiliği başka bir ebeveyne devret.");

        await using var tx = await db.Database.BeginTransactionAsync();
        bool planDeleted;
        if (member.Status == MemberStatus.Joined && member.UserId != null)
        {
            await families.DetachToOwnFamilyAsync(member);
            planDeleted = false;
        }
        else
        {
            await families.DeleteProfileAsync(member);
            planDeleted = true;
        }
        await tx.CommitAsync();
        return Ok(new { removedMemberId = id, planDeleted });
    }

    // Yönetici olmayan, hesabı olan üye kendi isteğiyle ayrılır; planı onunla gider.
    [HttpPost("leave")]
    public async Task<IActionResult> Leave()
    {
        var me = await members.GetCurrentAsync();
        if (me == null) return Err.FamilyRequired();
        if (me.IsAdmin)
            return Err.BadRequest("admin_cannot_leave", "Aileden ayrılmadan önce yöneticiliği başka bir ebeveyne devretmelisin.");

        await using var tx = await db.Database.BeginTransactionAsync();
        var newMember = await families.DetachToOwnFamilyAsync(me);
        await tx.CommitAsync();
        var family = await db.Families.FindAsync(newMember.FamilyId);
        return Ok(new FamilySummaryDto(family!.Id, family.Name, newMember.Id, newMember.DisplayName, newMember.Role.ToString(), newMember.IsAdmin));
    }

    [HttpPost("transfer-admin")]
    public async Task<IActionResult> TransferAdmin(TransferAdminDto dto)
    {
        var (me, error) = await RequireAdmin();
        if (error != null) return error;
        var target = await db.FamilyMembers.FirstOrDefaultAsync(m => m.Id == dto.MemberId && m.FamilyId == me!.FamilyId && m.Status != MemberStatus.Left);
        if (target == null) return Err.NotFound("member_not_found", "Üye bulunamadı.");
        if (target.Id == me!.Id) return Err.BadRequest("already_admin", "Zaten yöneticisin.");
        if (target.Status != MemberStatus.Joined || target.Role != FamilyRole.Parent)
            return Err.BadRequest("transfer_target_invalid", "Yöneticilik yalnızca aileye katılmış, Ebeveyn rolündeki bir üyeye devredilebilir.");

        await using var tx = await db.Database.BeginTransactionAsync();
        me.IsAdmin = false;
        await db.SaveChangesAsync(); // "ailede tek yönetici" indeksi için önce eski yönetici bırakılır
        target.IsAdmin = true;
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return Ok(await BuildFamilyDto(me));
    }

    // ---------- Yardımcılar ----------

    private async Task<(FamilyMember? Me, IActionResult? Error)> RequireAdmin()
    {
        var me = await members.GetCurrentAsync();
        if (me == null) return (null, Err.FamilyRequired());
        if (!me.IsAdmin) return (null, Err.AdminOnly());
        return (me, null);
    }

    private async Task<IActionResult?> ValidateInviteEmail(FamilyMember me, string email)
    {
        var normalized = InvitationService.NormalizeEmail(email);
        var inFamily = await db.FamilyMembers.AnyAsync(m =>
            m.FamilyId == me.FamilyId && m.Status == MemberStatus.Joined && m.User!.NormalizedEmail == normalized);
        if (inFamily) return Err.Conflict("already_member", "Bu e-posta adresine sahip kişi zaten ailende.");
        var pending = await db.Invitations.AnyAsync(i =>
            i.FamilyId == me.FamilyId && i.NormalizedEmail == normalized && i.Status == InvitationStatus.Pending);
        if (pending) return Err.Conflict("already_invited", "Bu adrese zaten bir davet gönderilmiş. Davet listesinden yeniden gönderebilirsin.");
        return null;
    }

    private async Task<(Invitation Inv, string Token, string Code)> CreateInvitation(FamilyMember me, FamilyMember member, string email)
    {
        var inv = new Invitation
        {
            FamilyId = me.FamilyId,
            MemberId = member.Id,
            Email = email.Trim(),
            NormalizedEmail = InvitationService.NormalizeEmail(email),
            InvitedByMemberId = me.Id,
            CreatedAt = DateTime.UtcNow
        };
        var (token, code) = InvitationService.Rotate(inv);
        db.Invitations.Add(inv);
        await db.SaveChangesAsync();
        return (inv, token, code);
    }

    private async Task<bool> TrySend(Invitation inv, FamilyMember member, FamilyMember me, string token, string code)
    {
        try
        {
            await invitations.SendEmailAsync(inv, member, me.Family!.Name, me.DisplayName, token, code);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Davet e-postası gönderilemedi");
            return false;
        }
    }

    private static InvitationDto ToDto(Invitation i, DateTime now)
    {
        var status = i.EffectiveStatus(now);
        return new InvitationDto(
            i.Id, i.MemberId, i.Member?.DisplayName ?? "", i.Email, i.Member?.Role.ToString() ?? "",
            status.ToString(), i.ExpiresAt, i.LastSentAt, i.CreatedAt, i.InvitedBy?.DisplayName,
            status == InvitationStatus.Pending ? (int)Math.Max(0, (i.ExpiresAt - now).TotalSeconds) : null);
    }

    private async Task<FamilyMemberDto> MemberDto(FamilyMember me, int memberId)
    {
        var dto = await BuildFamilyDto(me);
        return dto.Members.First(m => m.Id == memberId);
    }

    private async Task<FamilyDto> BuildFamilyDto(FamilyMember me)
    {
        // Rol değişmiş olabilir; güncel halini oku.
        await db.Entry(me).ReloadAsync();
        var family = await db.Families.AsNoTracking().FirstAsync(f => f.Id == me.FamilyId);
        var list = await db.FamilyMembers.AsNoTracking()
            .Include(m => m.User)
            .Where(m => m.FamilyId == me.FamilyId && m.Status != MemberStatus.Left)
            .ToListAsync();
        var ids = list.Select(m => m.Id).ToList();
        var invites = await db.Invitations.AsNoTracking()
            .Include(i => i.Member).Include(i => i.InvitedBy)
            .Where(i => ids.Contains(i.MemberId))
            .ToListAsync();
        var latest = invites.GroupBy(i => i.MemberId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(i => i.CreatedAt).First());
        var now = DateTime.UtcNow;

        var memberDtos = list
            // Kişi seçicide çocuklar önce listelenir.
            .OrderBy(m => m.Role == FamilyRole.Child ? 0 : 1)
            .ThenBy(m => m.CreatedAt).ThenBy(m => m.Id)
            .Select(m =>
            {
                latest.TryGetValue(m.Id, out var inv);
                return new FamilyMemberDto(
                    m.Id, m.DisplayName, m.Role.ToString(), m.Status.ToString(), m.IsAdmin,
                    HasAccount: m.UserId != null,
                    IsMe: m.Id == me.Id,
                    CanEdit: MemberContext.CanEdit(me, m),
                    Email: m.User?.Email ?? (m.Status == MemberStatus.Invited ? inv?.Email : null),
                    Invitation: inv == null ? null : ToDto(inv, now));
            })
            .ToList();

        return new FamilyDto(family.Id, family.Name, family.CreatedAt, me.Id, me.IsAdmin, me.Role.ToString(), memberDtos);
    }
}
