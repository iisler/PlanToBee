namespace PlanToBee.API.Models;

// Oturum yenileme belirteci. Belirtecin kendisi saklanmaz, yalnızca SHA-256 özeti saklanır.
// Her kullanımda yenisiyle değiştirilir (rotation); kullanılmış bir belirteç tekrar gelirse çalınmış sayılır
// ve kullanıcının bütün oturumları kapatılır.
public class RefreshToken
{
    public long Id { get; set; }
    public string UserId { get; set; } = "";
    public User? User { get; set; }
    public string TokenHash { get; set; } = "";
    // Bu cihazda seçili profil. Yenilenen erişim belirteci aynı profille verilir (cihaz profili hatırlar).
    public int? MemberId { get; set; }
    // Belirteç verildiğindeki security stamp: şifre değişince eski oturumlar yenilenemez.
    public string SecurityStamp { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    // Yenilenince yerine verilen belirtecin özeti; boşsa belirteç çıkışla ya da güvenlik nedeniyle iptal edildi.
    public string? ReplacedByHash { get; set; }
}
