namespace PlanToBee.API.Models;

// ESKİ: Antrenmanlar MergeTrainingIntoEvents migration'ıyla Events tablosuna (Kind = Training) taşındı.
// Bu tablo bir sürüm boyunca yedek olarak bekletilir; uygulama kodu artık okumaz ve yazmaz.
// Bir sonraki görevde tablo ve bu sınıf kaldırılacak.
public class TrainingEntry : AuditedEntity
{
    public int Id { get; set; }
    public int DayId { get; set; }
    public string Type { get; set; } = "";
    public int Minutes { get; set; }
    public string Note { get; set; } = "";
    public Day? Day { get; set; }
}
