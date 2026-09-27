namespace PlanToBee.API.Models;

// Kayıt izleri: ekleyen / en son düzenleyen üye ve zamanları.
// Üye silinirse (yalnızca hesapsız profil) alanlar NULL olur.
public abstract class AuditedEntity
{
    public int? CreatedByMemberId { get; set; }
    public FamilyMember? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? UpdatedByMemberId { get; set; }
    public FamilyMember? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    // Firebase'den aktarılan kayıtlar (4. faz) için
    public bool IsImported { get; set; }
}
