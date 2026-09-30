namespace PlanToBee.API.Services.Email;

public record EmailMessage(string To, string Subject, string TextBody, string HtmlBody);

// Uygulamanın e-posta gönderme soyutlaması. Sağlayıcı Email:Provider ayarıyla seçilir:
// "Log" (geliştirme: konsola ve dosyaya yazar) veya "Smtp".
public interface IAppEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken ct = default);
}
