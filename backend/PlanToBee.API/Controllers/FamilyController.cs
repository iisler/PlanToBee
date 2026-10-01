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

// Aile: tek hesapla giriş yapılan profiller grubu. Profil işlemleri ProfilesController'dadır.
[ApiController]
[Route("api/family")]
[Authorize]
[RequireVerifiedEmail]
[EnableRateLimiting(RateLimitPolicies.Api)]
public class FamilyController(
    AppDbContext db,
    UserManager<User> userManager,
    MemberContext members,
    FamilyService families,
    AuthTokenService tokens) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var me = await members.GetCurrentAsync();
        if (me == null) return await members.MissingAsync();
        return Ok(await BuildFamilyDto(db, me));
    }

    // Hesabın ailesini kurar; hesap sahibinin profili Ebeveyn rolünde ve PIN'iyle oluşur, oturum bu profille açılır.
    [HttpPost]
    public async Task<IActionResult> Create(CreateFamilyDto dto)
    {
        var name = dto.Name.Trim();
        var profileName = dto.ProfileName.Trim();
        if (name.Length == 0) return Err.BadRequest("validation", "Aile adı girin.");
        if (profileName.Length == 0) return Err.BadRequest("validation", "Adını girin.");
        if (!PinService.IsValidFormat(dto.Pin)) return Err.BadRequest("validation", "PIN 4 rakamdan oluşmalı.");
        if (await members.GetOwnerAsync() != null)
            return Err.Conflict("already_in_family", "Bu hesabın zaten bir ailesi var.");

        var user = await userManager.GetUserAsync(User);
        if (user == null) return Unauthorized();
        FamilyMember owner;
        try
        {
            owner = await families.CreateFamilyAsync(user, name, profileName, dto.Pin);
        }
        catch (DbUpdateException)
        {
            // Eşzamanlı iki oluşturma isteği: benzersiz UserId indeksi ikincisini reddeder.
            return Err.Conflict("already_in_family", "Bu hesabın zaten bir ailesi var.");
        }
        if (dto.RefreshToken != null) await tokens.RevokeAsync(dto.RefreshToken);
        return Ok(await tokens.BuildAuthResponse(user, owner.Id));
    }

    [HttpPut]
    public async Task<IActionResult> Rename(FamilyNameDto dto)
    {
        var me = await members.GetCurrentAsync();
        if (me == null) return await members.MissingAsync();
        if (me.Role != FamilyRole.Parent) return Err.ParentOnly();
        var name = dto.Name.Trim();
        if (name.Length == 0) return Err.BadRequest("validation", "Aile adı girin.");
        me.Family!.Name = name;
        await db.SaveChangesAsync();
        return Ok(await BuildFamilyDto(db, me));
    }

    internal static async Task<FamilyDto> BuildFamilyDto(AppDbContext db, FamilyMember me)
    {
        var family = me.Family ?? await db.Families.AsNoTracking().FirstAsync(f => f.Id == me.FamilyId);
        var profiles = await ListProfiles(db, me.FamilyId, me.Id);
        return new FamilyDto(family.Id, family.Name, family.CreatedAt, me.Id, me.Role == FamilyRole.Parent, profiles);
    }

    // Aktif profiller: önce hesap sahibi, sonra ebeveynler, sonra çocuklar (eklenme sırasıyla).
    internal static async Task<List<ProfileDto>> ListProfiles(AppDbContext db, int familyId, int? currentId)
    {
        var now = DateTime.UtcNow;
        var list = await db.FamilyMembers.AsNoTracking()
            .Where(m => m.FamilyId == familyId && m.Status == MemberStatus.Active)
            .OrderByDescending(m => m.IsAdmin).ThenBy(m => m.Role == FamilyRole.Child).ThenBy(m => m.CreatedAt).ThenBy(m => m.Id)
            .ToListAsync();
        return list.Select(m => ToDto(m, currentId, now)).ToList();
    }

    internal static ProfileDto ToDto(FamilyMember m, int? currentId, DateTime now) =>
        new(m.Id, m.DisplayName, m.Role.ToString(), m.PinHash != null, m.IsAdmin, m.Id == currentId,
            m.PinLockedUntil is { } until && until > now ? (int)Math.Ceiling((until - now).TotalSeconds) : null);
}
