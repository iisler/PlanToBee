namespace PlanToBee.API.Models;

public class Subject : AuditedEntity
{
    public int Id { get; set; }
    // Ders listesi ailenin ortak planına aittir
    public int FamilyId { get; set; }
    public Family? Family { get; set; }
    public string Name { get; set; } = "";
}
