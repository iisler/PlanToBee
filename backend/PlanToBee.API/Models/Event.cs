namespace PlanToBee.API.Models;

// Aktivite türü. Veritabanında metin olarak saklanır; yeni tür eklemek migration gerektirmez (sona eklenir).
public enum EventKind
{
    // Diğer (eski "etkinlik" kayıtları da bu türdedir)
    Event,
    // Spor. Eski antrenman kayıtlarında ad yerine TrainingType (Top, Kuvvet, Maç, Kondisyon ya da yazılan) doludur.
    Training,
    Music,
    Concert,
    Meeting,
    Exam
}

// Günün aktiviteleri tek listede. Saat isteğe bağlı (SS:dd; eski kayıtlarda serbest metin olabilir).
// Bitiş (EndTime) isteğe bağlı ve yalnızca SS:dd başlangıcı olan kayıtta bulunur; başlangıçtan önceyse kayıt gece
// yarısını aşar.
public class Event : AuditedEntity
{
    public int Id { get; set; }
    public int DayId { get; set; }
    public EventKind Kind { get; set; }
    // Aktivitenin adı. Eski antrenman kayıtlarında boş olabilir (ad TrainingType'tan türetilir).
    public string Title { get; set; } = "";
    public string Time { get; set; } = "";
    // null = bitiş girilmemiş. Boş bırakılabilir sütun: eski kod bu alanı hiç yazmaz, NULL kalır.
    public string? EndTime { get; set; }
    public string Note { get; set; } = "";
    // Yalnızca sporda dolu olabilir (eski antrenman kayıtları)
    public string? TrainingType { get; set; }
    public int? Minutes { get; set; }
    public Day? Day { get; set; }
}
