namespace PlanToBee.API.Models;

// Aile: tek hesapla giriş yapılan, profillerin ve ortak planın grubu. Hesap sahibinin profili IsAdmin=true
// olan tek profildir (FamilyMembers üzerinde kısmi benzersiz indeksle zorunlu).
public class Family
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public List<FamilyMember> Members { get; set; } = [];
}
