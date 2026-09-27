namespace PlanToBee.API.Models;

public class Subject : AuditedEntity
{
    public int Id { get; set; }
    // Ders listesinin ait olduğu plan sahibi üye
    public int MemberId { get; set; }
    public FamilyMember? Member { get; set; }
    public string Name { get; set; } = "";
}
