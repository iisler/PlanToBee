namespace PlanToBee.API.Models;

public class StudyEntry : AuditedEntity
{
    public int Id { get; set; }
    public int DayId { get; set; }
    public string Subject { get; set; } = "";
    public string Topic { get; set; } = "";
    public int Minutes { get; set; }
    public string Status { get; set; } = "todo";
    public Day? Day { get; set; }
}
