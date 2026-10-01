namespace PlanToBee.API.Models;

public enum FamilyRole
{
    Parent,
    Child
}

public enum MemberStatus
{
    // Aktif profil
    Active,
    // Silinmiş profil. Satır, kayıtlarda "Eski üye: [Ad]" gösterimi için saklanır.
    Left
}

// Aile profili (Netflix tarzı). Aile tek bir hesapla (sahibin e-postası ve şifresi) giriş yapar; girişten sonra
// cihazda profil seçilir. Plan (Day, Subject) ailenin ortak planıdır; profil, kayıtların izinde
// (ekleyen / düzenleyen) ve yetki kontrolünde kullanılır.
public class FamilyMember
{
    public int Id { get; set; }
    public int FamilyId { get; set; }
    public Family? Family { get; set; }
    public string DisplayName { get; set; } = "";
    public FamilyRole Role { get; set; }
    public MemberStatus Status { get; set; }
    // Hesap sahibinin profili (ailede tek). Silinemez, Ebeveyn rolünde kalır.
    public bool IsAdmin { get; set; }
    // Yalnızca hesap sahibinin profilinde dolu: hesap -> aile bağı. Bir hesap tek bir aileye sahip olabilir.
    public string? UserId { get; set; }
    public User? User { get; set; }
    // Profil PIN'inin özeti (PBKDF2, PasswordHasher). Ebeveyn profillerinde zorunlu, çocuklarda isteğe bağlı.
    public string? PinHash { get; set; }
    public int FailedPinAttempts { get; set; }
    public DateTime? PinLockedUntil { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LeftAt { get; set; }
}
