namespace PlanToBee.API.Models;

public class TrainingEntry : AuditedEntity
{
    public int Id { get; set; }
    public int DayId { get; set; }
    public string Type { get; set; } = "";
    public int Minutes { get; set; }
    public string Note { get; set; } = "";
    public Day? Day { get; set; }
}
