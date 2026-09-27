namespace PlanToBee.API.Models;

public class Event : AuditedEntity
{
    public int Id { get; set; }
    public int DayId { get; set; }
    public string Title { get; set; } = "";
    public string Time { get; set; } = "";
    public string Note { get; set; } = "";
    public Day? Day { get; set; }
}
