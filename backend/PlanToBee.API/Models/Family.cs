namespace PlanToBee.API.Models;

// Aile: planların paylaşıldığı grup. Yönetici, IsAdmin=true olan tek üyedir
// (FamilyMembers üzerinde kısmi benzersiz indeksle zorunlu).
public class Family
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public List<FamilyMember> Members { get; set; } = [];
}
