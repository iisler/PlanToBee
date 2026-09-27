namespace PlanToBee.API.Models;

public class Day
{
    public int Id { get; set; }
    // Plan sahibi aile üyesi
    public int MemberId { get; set; }
    public FamilyMember? Member { get; set; }
    public DateOnly Date { get; set; }
    public List<StudyEntry> StudyEntries { get; set; } = [];
    public List<TrainingEntry> TrainingEntries { get; set; } = [];
    public List<Event> Events { get; set; } = [];
}
