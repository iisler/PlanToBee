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

public class AuthTokenService(UserManager<User> userManager, AppDbContext db, IConfiguration config)
{
    public async Task<FamilySummaryDto?> GetFamilySummary(string userId) =>
        await db.FamilyMembers
            .Where(m => m.UserId == userId && m.Status == MemberStatus.Joined)
            .Select(m => new FamilySummaryDto(m.FamilyId, m.Family!.Name, m.Id, m.DisplayName, m.Role.ToString(), m.IsAdmin))
            .FirstOrDefaultAsync();

    public async Task<AuthResponseDto> BuildAuthResponse(User user) =>
        new(await CreateToken(user), user.Email!, user.DisplayName, user.DisplayName, user.EmailConfirmed, await GetFamilySummary(user.Id));

    public async Task<string> CreateToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Email, user.Email!),
            new Claim(ClaimTypes.Name, user.DisplayName),
            new Claim(AuthClaims.SecurityStamp, await userManager.GetSecurityStampAsync(user))
        };
        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(30),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        );
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
