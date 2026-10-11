namespace PlanToBee.API.Models;

// Başlangıç (StartTime) isteğe bağlı, SS:dd. Bitiş saklanmaz: her zaman başlangıç + Minutes (PlanText.StudyEndTime).
public class StudyEntry : AuditedEntity
{
    public int Id { get; set; }
    public int DayId { get; set; }
    public string Subject { get; set; } = "";
    public string Topic { get; set; } = "";
    public int Minutes { get; set; }
    // null = saatsiz ders. Boş bırakılabilir sütun: eski kod bu alanı hiç yazmaz, NULL kalır.
    public string? StartTime { get; set; }
    public string Status { get; set; } = "todo";
    public Day? Day { get; set; }
}
