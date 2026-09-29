using System.Globalization;
using Microsoft.EntityFrameworkCore;
using PlanToBee.API.Data;
using PlanToBee.API.Models;

namespace PlanToBee.API.Services;

// Aile üyeliği ve plan taşıma işlemleri. Çağıran taraf işlemleri bir transaction içinde yürütür.
public class FamilyService(AppDbContext db)
{
    private static readonly StringComparer TurkishIgnoreCase =
        StringComparer.Create(new CultureInfo("tr-TR"), ignoreCase: true);

    public static string DefaultFamilyName(string displayName) =>
        string.IsNullOrWhiteSpace(displayName) ? "Ailem" : Truncate($"{displayName.Trim()} Ailesi", 100);

    public static string Truncate(string s, int max) => s.Length <= max ? s : s[..max];

    // Kullanıcı için yeni bir aile açar; kullanıcı Ebeveyn rolünde yönetici olur.
    public async Task<FamilyMember> CreateFamilyAsync(User user, string familyName)
    {
        var now = DateTime.UtcNow;
        var family = new Family { Name = familyName, CreatedAt = now };
        var member = new FamilyMember
        {
            Family = family,
            DisplayName = Truncate(string.IsNullOrWhiteSpace(user.DisplayName) ? (user.UserName ?? "Ben") : user.DisplayName, 50),
            Role = FamilyRole.Parent,
            Status = MemberStatus.Joined,
            IsAdmin = true,
            UserId = user.Id,
            CreatedAt = now,
            JoinedAt = now
        };
        db.Families.Add(family);
        db.FamilyMembers.Add(member);
        await db.SaveChangesAsync();
        return member;
    }

    // Hesabı olan üyeyi aileden ayırır: üye satırı "Ayrıldı" olarak kalır (eski üye izi için),
    // kullanıcıya yeni tek kişilik bir aile açılır. Plan ailenin ortak planı olduğu için ailede kalır;
    // üyenin eklediği kayıtlarda "Eski üye: [Ad]" görünür.
    public async Task<FamilyMember> DetachToOwnFamilyAsync(FamilyMember member)
    {
        if (member.UserId == null) throw new InvalidOperationException("Hesapsız üye ayrılamaz");
        var user = await db.Users.FirstAsync(u => u.Id == member.UserId);

        MarkLeft(member);
        await db.SaveChangesAsync(); // benzersiz UserId indeksi için önce eski bağ kaldırılır

        return await CreateFamilyAsync(user, DefaultFamilyName(user.DisplayName));
    }

    public static void MarkLeft(FamilyMember member)
    {
        member.Status = MemberStatus.Left;
        member.UserId = null;
        member.IsAdmin = false;
        member.LeftAt = DateTime.UtcNow;
    }

    // Hesapsız profili veya daveti bekleyen üyeyi kalıcı olarak siler. Davetleri FK cascade ile silinir;
    // eklediği kayıtlar ailenin planında kalır, kayıt izindeki üye bağı boşalır (SetNull).
    public async Task DeleteProfileAsync(FamilyMember member)
    {
        db.FamilyMembers.Remove(member);
        await db.SaveChangesAsync();
    }

    // Başka üyesi kalmamış eski ailenin planını (günler, kayıtlar, ders listesi) yeni aileye birleştirir.
    // Aynı tarihte iki gün varsa kayıtlar hedef güne taşınır; aynı adlı dersler tekrar eklenmez.
    // Taşınan kayıtlardaki eski üyelik izleri (fromMember) kişinin yeni üyeliğine (toMember) çevrilir.
    public async Task MergeFamilyPlanAsync(int fromFamilyId, int toFamilyId, int fromMemberId, int toMemberId)
    {
        var targetDays = await db.Days.Where(d => d.FamilyId == toFamilyId)
            .ToDictionaryAsync(d => d.Date, d => d.Id);
        var sourceDays = await db.Days.Where(d => d.FamilyId == fromFamilyId).ToListAsync();

        foreach (var day in sourceDays)
        {
            if (targetDays.TryGetValue(day.Date, out var targetDayId))
            {
                var srcId = day.Id;
                await db.StudyEntries.Where(e => e.DayId == srcId).ExecuteUpdateAsync(s => s.SetProperty(e => e.DayId, targetDayId));
                await db.TrainingEntries.Where(e => e.DayId == srcId).ExecuteUpdateAsync(s => s.SetProperty(e => e.DayId, targetDayId));
                await db.Events.Where(e => e.DayId == srcId).ExecuteUpdateAsync(s => s.SetProperty(e => e.DayId, targetDayId));
                db.Days.Remove(day);
            }
            else
            {
                day.FamilyId = toFamilyId;
            }
        }

        var targetNames = await db.Subjects.Where(s => s.FamilyId == toFamilyId).Select(s => s.Name).ToListAsync();
        var sourceSubjects = await db.Subjects.Where(s => s.FamilyId == fromFamilyId).ToListAsync();
        foreach (var subject in sourceSubjects)
        {
            if (targetNames.Any(n => TurkishIgnoreCase.Equals(n.Trim(), subject.Name.Trim())))
                db.Subjects.Remove(subject);
            else
            {
                subject.FamilyId = toFamilyId;
                targetNames.Add(subject.Name);
            }
        }
        await db.SaveChangesAsync();

        await RemapAuditAsync(toFamilyId, fromMemberId, toMemberId);
    }

    private async Task RemapAuditAsync(int familyId, int from, int to)
    {
        await db.StudyEntries.Where(e => e.Day!.FamilyId == familyId && e.CreatedByMemberId == from).ExecuteUpdateAsync(s => s.SetProperty(e => e.CreatedByMemberId, to));
        await db.StudyEntries.Where(e => e.Day!.FamilyId == familyId && e.UpdatedByMemberId == from).ExecuteUpdateAsync(s => s.SetProperty(e => e.UpdatedByMemberId, to));
        await db.TrainingEntries.Where(e => e.Day!.FamilyId == familyId && e.CreatedByMemberId == from).ExecuteUpdateAsync(s => s.SetProperty(e => e.CreatedByMemberId, to));
        await db.TrainingEntries.Where(e => e.Day!.FamilyId == familyId && e.UpdatedByMemberId == from).ExecuteUpdateAsync(s => s.SetProperty(e => e.UpdatedByMemberId, to));
        await db.Events.Where(e => e.Day!.FamilyId == familyId && e.CreatedByMemberId == from).ExecuteUpdateAsync(s => s.SetProperty(e => e.CreatedByMemberId, to));
        await db.Events.Where(e => e.Day!.FamilyId == familyId && e.UpdatedByMemberId == from).ExecuteUpdateAsync(s => s.SetProperty(e => e.UpdatedByMemberId, to));
        await db.Subjects.Where(e => e.FamilyId == familyId && e.CreatedByMemberId == from).ExecuteUpdateAsync(s => s.SetProperty(e => e.CreatedByMemberId, to));
        await db.Subjects.Where(e => e.FamilyId == familyId && e.UpdatedByMemberId == from).ExecuteUpdateAsync(s => s.SetProperty(e => e.UpdatedByMemberId, to));
    }
}
