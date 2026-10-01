namespace PlanToBee.API.Models;

public enum EventKind
{
    // Sınav, toplantı gibi adı olan etkinlik
    Event,
    // Antrenman: adı yok; antrenman türü (Top, Kuvvet, Maç, Kondisyon ya da yazılan) ve süresi var
    Training
}

// Günün etkinlikleri ve antrenmanları tek listede. Saat her iki türde isteğe bağlı (SS:dd; eski kayıtlarda serbest metin olabilir).
public class Event : AuditedEntity
{
    public int Id { get; set; }
    public int DayId { get; set; }
    public EventKind Kind { get; set; }
    // Yalnızca etkinlikte dolu
    public string Title { get; set; } = "";
    public string Time { get; set; } = "";
    public string Note { get; set; } = "";
    // Yalnızca antrenmanda dolu
    public string? TrainingType { get; set; }
    public int? Minutes { get; set; }
    public Day? Day { get; set; }
}
