using PlanToBee.API.Data;
using PlanToBee.API.Models;

namespace PlanToBee.API.Services;

// Aile ve profil işlemleri.
public class FamilyService(AppDbContext db)
{
    public static string Truncate(string s, int max) => s.Length <= max ? s : s[..max];

    // Hesap için yeni bir aile açar; hesap sahibinin profili Ebeveyn rolünde oluşturulur (PIN isteğe bağlı).
    public async Task<FamilyMember> CreateFamilyAsync(User user, string familyName, string profileName, string? pin)
    {
        var now = DateTime.UtcNow;
        var family = new Family { Name = familyName, CreatedAt = now };
        var owner = new FamilyMember
        {
            Family = family,
            DisplayName = Truncate(profileName, 50),
            Role = FamilyRole.Parent,
            Status = MemberStatus.Active,
            IsAdmin = true,
            UserId = user.Id,
            CreatedAt = now,
        };
        if (pin != null) owner.PinHash = PinService.Hash(owner, pin);
        db.Families.Add(family);
        db.FamilyMembers.Add(owner);
        await db.SaveChangesAsync();
        return owner;
    }

    // Profil silinir: satır "Eski üye" olarak kalır, eklediği kayıtlar ailenin planında durur.
    public static void MarkLeft(FamilyMember member)
    {
        member.Status = MemberStatus.Left;
        member.PinHash = null;
        member.LeftAt = DateTime.UtcNow;
    }
}
