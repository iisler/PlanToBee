namespace PlanToBee.API.Models;

// Veritabanında yalnızca Pending / Accepted / Cancelled tutulur.
// "Süresi doldu" durumu Pending + ExpiresAt geçmiş olarak hesaplanır.
public enum InvitationStatus
{
    Pending,
    Accepted,
    Expired,
    Cancelled
}

public class Invitation
{
    public int Id { get; set; }
    public int FamilyId { get; set; }
    public Family? Family { get; set; }
    public int MemberId { get; set; }
    public FamilyMember? Member { get; set; }
    public string Email { get; set; } = "";
    public string NormalizedEmail { get; set; } = "";
    // Link belirtecinin ve yedek kodun kendisi saklanmaz, yalnızca SHA-256 özetleri saklanır.
    public string TokenHash { get; set; } = "";
    public string CodeHash { get; set; } = "";
    public string CodeSalt { get; set; } = "";
    public int FailedCodeAttempts { get; set; }
    public DateTime ExpiresAt { get; set; }
    public InvitationStatus Status { get; set; }
    public int? InvitedByMemberId { get; set; }
    public FamilyMember? InvitedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime LastSentAt { get; set; }
    public int SendCount { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    // Eşzamanlı iki kabul isteğine karşı iyimser eşzamanlılık (PostgreSQL xmin)
    public uint Version { get; set; }

    public InvitationStatus EffectiveStatus(DateTime now) =>
        Status == InvitationStatus.Pending && ExpiresAt <= now ? InvitationStatus.Expired : Status;
}
