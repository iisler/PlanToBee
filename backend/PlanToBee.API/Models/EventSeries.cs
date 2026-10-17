namespace PlanToBee.API.Models;

// Haftalık tekrarlayan aktivite: tek kural (seri) + istisna günleri. Tekrarlar veritabanında ayrı satır olarak
// tutulmaz, gün ve hafta okunurken tarihe yayılır (Services/SeriesSchedule.cs). Böylece "Hazirana kadar her hafta içi
// okul" 180 satır değil tek satırdır ve kuralı düzenlemek ayrılmamış bütün günleri birden değiştirir.
public class EventSeries : AuditedEntity
{
    public int Id { get; set; }
    public int FamilyId { get; set; }
    public Family? Family { get; set; }
    public EventKind Kind { get; set; }
    public string Title { get; set; } = "";
    // "" = saatsiz, aksi halde SS:dd. Serilerde eski serbest metin saat yoktur.
    public string Time { get; set; } = "";
    public string? EndTime { get; set; }
    public string Note { get; set; } = "";
    // Haftanın günleri bit maskesi: Pazartesi = 1, Salı = 2, ..., Pazar = 64 (SeriesSchedule.Bit).
    public int DaysOfWeek { get; set; }
    public DateOnly StartDate { get; set; }
    // Dahil. En fazla StartDate + 1 yıl.
    public DateOnly UntilDate { get; set; }
    public List<EventSeriesException> Exceptions { get; set; } = [];
}

// Serinin o tarihte görünmediği gün: "yalnızca bu gün" silinmiş ya da seriden ayrılmış (o güne normal Event
// oluşturulmuştur; ayrılan kayıt seriye bağlı değildir).
public class EventSeriesException
{
    public int Id { get; set; }
    public int SeriesId { get; set; }
    public EventSeries? Series { get; set; }
    public DateOnly Date { get; set; }
}
