namespace PlanToBee.API.Models;

// Bir cihazın bildirim aboneliği (Web Push). Cihazda seçili profil adına tutulur; profil değişince MemberId
// güncellenir. Endpoint, P256dh ve Auth veritabanında şifrelidir (PersonalDataProtector); aramak için
// EndpointIndex (anahtarlı özet) kullanılır.
public class PushSubscription
{
    public int Id { get; set; }
    public int FamilyId { get; set; }
    public int MemberId { get; set; }
    public FamilyMember? Member { get; set; }
    public string Endpoint { get; set; } = "";
    public string EndpointIndex { get; set; } = "";
    public string P256dh { get; set; } = "";
    public string Auth { get; set; } = "";
    // Cihaz listesinde görünen ad (örn. "iPhone · Safari"); kişisel veri içermez.
    public string DeviceLabel { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime? LastSuccessAt { get; set; }
}

// Profilin bildirim ayarları. Satır yoksa varsayılanlar geçerlidir (Defaults).
public class NotificationPreference
{
    public int MemberId { get; set; }
    public FamilyMember? Member { get; set; }
    public bool StudyAdded { get; set; } = true;
    public bool ActivityAdded { get; set; } = true;
    // Düzenleme ve silme
    public bool Changes { get; set; }
    public bool StudyDone { get; set; } = true;
    public bool QuietEnabled { get; set; } = true;
    public TimeOnly QuietStart { get; set; } = new(22, 0);
    public TimeOnly QuietEnd { get; set; } = new(7, 30);
    // "Kimin girişleri"nden çıkarılan profiller. Boş: herkes (kendisi hariç).
    public List<int> MutedMemberIds { get; set; } = [];

    public static NotificationPreference Defaults(int memberId) => new() { MemberId = memberId };
}

public enum NotificationCategory
{
    StudyAdded,
    ActivityAdded,
    Changed,
    Deleted,
    StudyDone
}

// Gönderilmeyi bekleyen bildirim olayı. Aynı kişinin art arda girişleri toplanıp tek bildirim olarak gider;
// sessiz saatte oluşanlar HoldUntil'e kadar bekler. Kuyruk veritabanında tutulur: sunucu yeniden başlasa ya da
// uykudan uyansa da kaybolmaz.
public class PendingNotification
{
    public long Id { get; set; }
    public int FamilyId { get; set; }
    public int RecipientMemberId { get; set; }
    public int ActorMemberId { get; set; }
    public string ActorName { get; set; } = "";
    public NotificationCategory Category { get; set; }
    // Tek kayıtlık bildirimde başlık ve gövde (örn. "Ela ders ekledi" / "📚 Matematik · 60 dk — Çarşamba 8 Eki")
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public DateOnly Date { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? HoldUntil { get; set; }
}
