using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using PlanToBee.API.Data;
using PlanToBee.API.DTOs;
using PlanToBee.API.Infrastructure;
using PlanToBee.API.Models;

namespace PlanToBee.API.Services;

// Oturum: kısa ömürlü erişim belirteci (JWT, varsayılan 15 dk) + uzun ömürlü yenileme belirteci (varsayılan 30 gün).
// Erişim belirteci çalınsa bile kısa sürede geçersiz olur; yenileme belirteci her kullanımda değişir.
public class AuthTokenService(UserManager<User> userManager, AppDbContext db, IConfiguration config, ILogger<AuthTokenService> logger)
{
    // Aynı yenileme belirteci iki sekmeden neredeyse aynı anda kullanılırsa ikincisi hırsızlık sayılmaz;
    // istemci güncel belirteci okuyup tekrar dener (refresh_retry).
    private static readonly TimeSpan ReuseGrace = TimeSpan.FromSeconds(30);

    private TimeSpan AccessLifetime => TimeSpan.FromMinutes(config.GetValue("Jwt:AccessTokenMinutes", 15));
    private TimeSpan RefreshLifetime => TimeSpan.FromDays(config.GetValue("Jwt:RefreshTokenDays", 30));

    public async Task<FamilySummaryDto?> GetFamilySummary(string userId) =>
        await db.FamilyMembers
            .Where(m => m.UserId == userId && m.Status == MemberStatus.Active)
            .Select(m => new FamilySummaryDto(m.FamilyId, m.Family!.Name))
            .FirstOrDefaultAsync();

    // Hesabın ailesindeki aktif profil; profil silinmişse ya da başka aileye aitse null.
    public async Task<ProfileSummaryDto?> GetProfileSummary(string userId, int? memberId)
    {
        if (memberId == null) return null;
        var familyId = await db.FamilyMembers
            .Where(m => m.UserId == userId && m.Status == MemberStatus.Active)
            .Select(m => (int?)m.FamilyId).FirstOrDefaultAsync();
        if (familyId == null) return null;
        return await db.FamilyMembers
            .Where(m => m.Id == memberId && m.FamilyId == familyId && m.Status == MemberStatus.Active)
            .Select(m => new ProfileSummaryDto(m.Id, m.DisplayName, m.Role.ToString(), m.IsAdmin))
            .FirstOrDefaultAsync();
    }

    // Yeni oturum açar (giriş, şifre sıfırlama, profil seçimi): erişim + yenileme belirteci.
    // memberId verilirse oturum o profille açılır ve cihaz profili hatırlar.
    public async Task<AuthResponseDto> BuildAuthResponse(User user, int? memberId = null)
    {
        var now = DateTime.UtcNow;
        // Süresi dolmuş eski belirteçler temizlenir; tablo kullanıcı başına küçük kalır.
        await db.RefreshTokens.Where(t => t.UserId == user.Id && t.ExpiresAt < now).ExecuteDeleteAsync();
        var refresh = SecureCodes.NewToken();
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = SecureCodes.Sha256(refresh),
            MemberId = memberId,
            SecurityStamp = await userManager.GetSecurityStampAsync(user),
            CreatedAt = now,
            ExpiresAt = now + RefreshLifetime,
        });
        await db.SaveChangesAsync();
        return await Response(user, refresh, memberId);
    }

    // Yenileme belirtecini yenisiyle değiştirir. Hata kodları: refresh_invalid (yeniden giriş gerekir),
    // refresh_retry (belirteç az önce başka bir istekte yenilendi; istemci güncel belirteçle tekrar dener).
    public async Task<(AuthResponseDto? Response, string? Error)> RefreshAsync(string raw)
    {
        var now = DateTime.UtcNow;
        var hash = SecureCodes.Sha256(raw);
        var row = await db.RefreshTokens.AsNoTracking().FirstOrDefaultAsync(t => t.TokenHash == hash);
        if (row == null || row.ExpiresAt <= now) return (null, "refresh_invalid");

        if (row.RevokedAt != null)
        {
            if (row.ReplacedByHash == null) return (null, "refresh_invalid"); // çıkış yapılmış
            if (now - row.RevokedAt < ReuseGrace) return (null, "refresh_retry");
            // Değiştirilmiş bir belirteç tekrar kullanıldı: belirteç çalınmış olabilir, bütün oturumlar kapanır.
            logger.LogWarning("Kullanılmış yenileme belirteci tekrar geldi; kullanıcının oturumları kapatıldı. UserId={UserId}", row.UserId);
            await RevokeAllAsync(row.UserId);
            return (null, "refresh_invalid");
        }

        var user = await userManager.FindByIdAsync(row.UserId);
        if (user == null || !SecureCodes.FixedTimeEquals(row.SecurityStamp, await userManager.GetSecurityStampAsync(user)))
        {
            await db.RefreshTokens.Where(t => t.Id == row.Id).ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now));
            return (null, "refresh_invalid");
        }

        var next = SecureCodes.NewToken();
        var nextHash = SecureCodes.Sha256(next);
        // Koşullu güncelleme: aynı belirteçle eşzamanlı iki istekten yalnızca biri yenileyebilir.
        var won = await db.RefreshTokens
            .Where(t => t.Id == row.Id && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now).SetProperty(t => t.ReplacedByHash, nextHash));
        if (won == 0) return (null, "refresh_retry");

        // Profil silinmişse yeni oturum profilsiz açılır; istemci profil seçme ekranına döner.
        var memberId = (await GetProfileSummary(user.Id, row.MemberId))?.Id;
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = nextHash,
            MemberId = memberId,
            SecurityStamp = row.SecurityStamp,
            CreatedAt = now,
            ExpiresAt = now + RefreshLifetime,
        });
        await db.SaveChangesAsync();
        return (await Response(user, next, memberId), null);
    }

    // Çıkış: yalnızca bu cihazın belirteci iptal edilir. Bilinmeyen belirteç sessizce yok sayılır.
    public Task RevokeAsync(string raw)
    {
        var hash = SecureCodes.Sha256(raw);
        return db.RefreshTokens.Where(t => t.TokenHash == hash && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTime.UtcNow));
    }

    // Şifre değişince ya da belirteç hırsızlığı şüphesinde kullanıcının bütün oturumları kapanır.
    public Task RevokeAllAsync(string userId) =>
        db.RefreshTokens.Where(t => t.UserId == userId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTime.UtcNow));

    private async Task<AuthResponseDto> Response(User user, string refresh, int? memberId)
    {
        var profile = await GetProfileSummary(user.Id, memberId);
        return new(await CreateToken(user, profile?.Id), refresh, (int)AccessLifetime.TotalSeconds,
            user.Email!, user.DisplayName, user.DisplayName, user.EmailConfirmed, await GetFamilySummary(user.Id), profile);
    }

    private async Task<string> CreateToken(User user, int? memberId)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Email, user.Email!),
            new(ClaimTypes.Name, user.DisplayName),
            new(AuthClaims.SecurityStamp, await userManager.GetSecurityStampAsync(user))
        };
        if (memberId != null) claims.Add(new(AuthClaims.Member, memberId.Value.ToString()));
        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow + AccessLifetime,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        );
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
