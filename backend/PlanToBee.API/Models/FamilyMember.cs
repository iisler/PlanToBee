namespace PlanToBee.API.Models;

public enum FamilyRole
{
    Parent,
    Child
}

public enum MemberStatus
{
    // Hesapsız çocuk profili (planı ebeveynler yönetir)
    NoAccount,
    // Davet gönderildi, henüz katılmadı
    Invited,
    // Hesabı bağlı, aktif üye
    Joined,
    // Aileden ayrıldı / çıkarıldı. Satır, "Eski üye: [Ad]" gösterimi için saklanır.
    Left
}

// Aile üyesi. Planın (Day, Subject) sahibi kullanıcı değil üyedir; böylece hesapsız
// profillerin ve daveti bekleyen üyelerin de planı olabilir.
public class FamilyMember
{
    public int Id { get; set; }
    public int FamilyId { get; set; }
    public Family? Family { get; set; }
    public string DisplayName { get; set; } = "";
    public FamilyRole Role { get; set; }
    public MemberStatus Status { get; set; }
    public bool IsAdmin { get; set; }
    // Yalnızca Joined üyede dolu. Bir kullanıcı en fazla bir üyeliğe bağlı olabilir (benzersiz indeks).
    public string? UserId { get; set; }
    public User? User { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? JoinedAt { get; set; }
    public DateTime? LeftAt { get; set; }
}
