using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PlanToBee.API.Data;
using PlanToBee.API.Infrastructure;
using PlanToBee.API.Models;
using PlanToBee.API.Services.Email;

namespace PlanToBee.API.Services;

public record InvitationResolveResult(Invitation? Invitation, Microsoft.AspNetCore.Mvc.ObjectResult? Error);

public class InvitationService(
    AppDbContext db,
    IAppEmailSender email,
    IOptions<AppOptions> app,
    ILogger<InvitationService> logger)
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);
    public const int MaxCodeAttempts = 5;

    public static string NormalizeEmail(string e) => e.Trim().ToUpperInvariant();

    // Yeni link belirteci ve yedek kod üretir, özetlerini saklar, süreyi 7 güne ayarlar.
    // Eski link ve kod (varsa) anında geçersiz olur. Döner: (token, code) açık halleri.
    public static (string Token, string Code) Rotate(Invitation inv)
    {
        var token = SecureCodes.NewToken();
        var code = SecureCodes.NewSixDigitCode();
        var now = DateTime.UtcNow;
        inv.TokenHash = SecureCodes.Sha256(token);
        inv.CodeSalt = SecureCodes.NewSalt();
        inv.CodeHash = SecureCodes.Sha256(inv.CodeSalt + code);
        inv.FailedCodeAttempts = 0;
        inv.ExpiresAt = now.Add(Lifetime);
        inv.LastSentAt = now;
        inv.SendCount++;
        inv.Status = InvitationStatus.Pending;
        return (token, code);
    }

    public async Task SendEmailAsync(Invitation inv, FamilyMember member, string familyName, string inviterName, string token, string code)
    {
        var link = app.Value.Link("invite", ("token", token));
        var roleText = member.Role == FamilyRole.Parent ? "ebeveyn" : "çocuk";
        try
        {
            await email.SendAsync(EmailTemplates.Invitation(inv.Email, member.DisplayName, familyName, inviterName, roleText, link, code, inv.ExpiresAt));
        }
        catch (Exception ex)
        {
            // Davet kaydı oluşmuştur; yönetici "Yeniden gönder" ile tekrar deneyebilir.
            logger.LogError(ex, "Davet e-postası gönderilemedi (davet {Id})", inv.Id);
            throw;
        }
    }

    // Link belirteci veya e-posta + yedek kod ile daveti bulur ve kullanılabilir olduğunu doğrular.
    // Hatalı kod denemeleri sayılır; MaxCodeAttempts'e ulaşınca kod kilitlenir (link çalışmaya devam eder).
    public async Task<InvitationResolveResult> ResolveAsync(string? token, string? emailAddress, string? code)
    {
        var now = DateTime.UtcNow;
        Invitation? inv;

        if (!string.IsNullOrWhiteSpace(token))
        {
            var hash = SecureCodes.Sha256(token.Trim());
            inv = await Query().FirstOrDefaultAsync(i => i.TokenHash == hash);
            if (inv == null)
                return Fail(Err.NotFound("invite_invalid",
                    "Davet bağlantısı geçersiz. Davet yeniden gönderilmiş olabilir; en son gelen e-postayı kullan ya da yöneticiden yeni davet iste."));
        }
        else if (!string.IsNullOrWhiteSpace(emailAddress) && !string.IsNullOrWhiteSpace(code))
        {
            var normalized = NormalizeEmail(emailAddress);
            code = code.Trim();
            // Bekleyen davetlerin yanında son 30 günde gönderilmiş kullanılmış/iptal edilmiş davetler de
            // aranır; doğru kod girildiğinde "eşleşmedi" yerine davetin gerçek durumu (invite_used /
            // invite_cancelled) dönülür. Doğru kod gerektiği için hesap varlığı dışarıya belli olmaz.
            // Eşleşme önce bekleyen davetlerde aranır; deneme sayacı yalnızca bekleyen davetlerde işler.
            var closedSince = now.AddDays(-30);
            var all = await Query()
                .Where(i => i.NormalizedEmail == normalized &&
                            (i.Status == InvitationStatus.Pending || i.LastSentAt > closedSince))
                .ToListAsync();
            var candidates = all.Where(i => i.Status == InvitationStatus.Pending).ToList();
            bool Matches(Invitation i) => SecureCodes.FixedTimeEquals(i.CodeHash, SecureCodes.Sha256(i.CodeSalt + code));
            inv = candidates.FirstOrDefault(Matches)
                  ?? all.Where(i => i.Status != InvitationStatus.Pending).OrderByDescending(i => i.LastSentAt).FirstOrDefault(Matches);

            if (inv == null)
            {
                foreach (var c in candidates.Where(c => c.ExpiresAt > now && c.FailedCodeAttempts < MaxCodeAttempts))
                    c.FailedCodeAttempts++;
                await db.SaveChangesAsync();
                if (candidates.Count > 0 && candidates.All(c => c.FailedCodeAttempts >= MaxCodeAttempts))
                    return Fail(CodeLocked());
                return Fail(Err.BadRequest("invite_code_invalid",
                    "E-posta adresi ve kod eşleşmedi. Davetin gönderildiği e-posta adresini ve 6 haneli kodu kontrol et."));
            }
            if (inv.FailedCodeAttempts >= MaxCodeAttempts) return Fail(CodeLocked());
        }
        else
        {
            return Fail(Err.BadRequest("invite_credentials_required", "Davet bağlantısı ya da e-posta ve 6 haneli kod gerekli."));
        }

        return inv.EffectiveStatus(now) switch
        {
            InvitationStatus.Accepted => Fail(Err.Gone("invite_used", "Bu davet zaten kullanılmış. Hesabın varsa giriş yap; yoksa yöneticiden yeni davet iste.")),
            InvitationStatus.Cancelled => Fail(Err.Gone("invite_cancelled", "Bu davet iptal edilmiş. Yöneticiden yeni davet iste.")),
            InvitationStatus.Expired => Fail(Err.Gone("invite_expired", "Bu davetin süresi dolmuş. Yöneticiden daveti yeniden göndermesini iste.")),
            _ when inv.Member == null || inv.Member.Status == MemberStatus.Left =>
                Fail(Err.Gone("invite_cancelled", "Bu davet artık geçerli değil. Yöneticiden yeni davet iste.")),
            _ => new InvitationResolveResult(inv, null)
        };
    }

    private IQueryable<Invitation> Query() =>
        db.Invitations.Include(i => i.Family).Include(i => i.Member).Include(i => i.InvitedBy);

    private static InvitationResolveResult Fail(Microsoft.AspNetCore.Mvc.ObjectResult r) => new(null, r);

    private static Microsoft.AspNetCore.Mvc.ObjectResult CodeLocked() =>
        Err.Make(429, "invite_code_locked",
            "Çok fazla hatalı kod denemesi yapıldı ve kod kilitlendi. E-postadaki bağlantıyı kullan ya da yöneticiden daveti yeniden göndermesini iste.");
}
