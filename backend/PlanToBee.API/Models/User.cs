using Microsoft.AspNetCore.Identity;

namespace PlanToBee.API.Models;

public class User : IdentityUser
{
    // Kullanıcının kendi görünen adı. Aile içindeki ad FamilyMember.DisplayName'dedir.
    public string DisplayName { get; set; } = "";

    // Kayıtta işaretlenen onay kutuları. Kayıt ikisi işaretlenmeden tamamlanmaz; kayıt anında true yazılır.
    // KVKK Aydınlatma Metni'nin okunduğu (bilgilendirme, açık rıza değil) ve Kullanım Koşulları'nın kabul edildiği.
    public bool IsKvkkChecked { get; set; }
    public bool IsTermsAccepted { get; set; }
    // Onayların verildiği an (UTC). Bu alanlardan önce açılmış hesaplarda boştur.
    public DateTime? ConsentsAcceptedAt { get; set; }
}
