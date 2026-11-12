using Microsoft.AspNetCore.Identity;

namespace PlanToBee.API.Models;

public class User : IdentityUser
{
    // Kullanıcının kendi görünen adı. Aile içindeki ad FamilyMember.DisplayName'dedir.
    public string DisplayName { get; set; } = "";

    // Kayıtta işaretlenen onay kutuları. Kayıt ikisi işaretlenmeden tamamlanmaz; kayıt anında true yazılır.
    // KVKK Aydınlatma Metni'nin okunduğu (bilgilendirme, açık rıza değil) ve Kullanım Koşulları'nın kabul edildiği.
    // Veritabanında 1 = onaylandı, 0 = onay yok (bkz. AppDbContext).
    public bool IsKvkkChecked { get; set; }
    public bool IsTermsAccepted { get; set; }
    // Onayların verildiği an (UTC). Bu alanlardan önce açılmış hesaplarda boştur.
    public DateTime? ConsentsAcceptedAt { get; set; }

    // Okunan / kabul edilen metin sürümü ve zamanı (UTC). Güncel sürüm: Infrastructure/LegalVersions.
    // Kayıtta ve yeniden onayda (POST /auth/consents) yazılır. Sürüm saklanmadan önce açılmış hesaplarda boştur
    // (hangi sürümü gördükleri kanıtlanamaz); bu hesaplardan girişten sonra yeniden onay istenir.
    public int? KvkkVersion { get; set; }
    public DateTime? KvkkReadAt { get; set; }
    public int? TermsVersion { get; set; }
    public DateTime? TermsAcceptedAt { get; set; }
}
