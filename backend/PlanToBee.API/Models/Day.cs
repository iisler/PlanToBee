namespace PlanToBee.API.Models;

// Ailenin ortak planındaki bir gün. Kaydı kimin eklediği kayıtların izinde (CreatedByMemberId) tutulur.
public class Day
{
    public int Id { get; set; }
    public int FamilyId { get; set; }
    public Family? Family { get; set; }
    public DateOnly Date { get; set; }
    public List<StudyEntry> StudyEntries { get; set; } = [];
    public List<TrainingEntry> TrainingEntries { get; set; } = [];
    public List<Event> Events { get; set; } = [];
}
