using System.Net;
using System.Net.Mail;
using System.Text;
using Microsoft.Extensions.Options;

namespace PlanToBee.API.Services.Email;

// SMTP ile gönderim (Gmail: smtp.gmail.com, Brevo: smtp-relay.brevo.com; ikisi de port 587).
// EnableSsl=true iken System.Net.Mail.SmtpClient bağlantıyı düz başlatır ve EHLO'dan sonra STARTTLS ile
// şifreler (açık/explicit TLS); sunucu sertifikası doğrulanır. Kimlik bilgileri yalnızca TLS kurulduktan
// sonra gönderilir. (SmtpClient 465 portundaki doğrudan/implicit TLS'i desteklemez; 587 veya 2525 kullanın.)
// Hata logları şifre, e-posta gövdesi, link veya kod içermez; yalnızca konu, SMTP durum kodu ve hata türü yazılır.
public class SmtpEmailSender(IOptions<EmailOptions> options, ILogger<SmtpEmailSender> logger) : IAppEmailSender
{
    // SendMailAsync kendi zaman aşımını uygulamaz; takılan bir SMTP bağlantısı isteği sonsuza kadar bekletmesin.
    private static readonly TimeSpan SendTimeout = TimeSpan.FromSeconds(30);

    public async Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        var o = options.Value;
        if (string.IsNullOrWhiteSpace(o.Smtp.Host))
            throw new InvalidOperationException("Email:Smtp:Host ayarlı değil.");

        using var client = new SmtpClient(o.Smtp.Host, o.Smtp.Port)
        {
            EnableSsl = o.Smtp.EnableSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = false
        };
        if (!string.IsNullOrEmpty(o.Smtp.Username))
            client.Credentials = new NetworkCredential(o.Smtp.Username, o.Smtp.Password);

        using var mail = new MailMessage
        {
            From = new MailAddress(o.From, o.FromName, Encoding.UTF8),
            Subject = message.Subject,
            SubjectEncoding = Encoding.UTF8,
            Body = message.TextBody,
            BodyEncoding = Encoding.UTF8,
            IsBodyHtml = false
        };
        mail.To.Add(message.To);
        mail.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(message.HtmlBody, Encoding.UTF8, "text/html"));

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(SendTimeout);
        try
        {
            await client.SendMailAsync(mail, cts.Token);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            logger.LogError("SMTP gönderimi {Seconds} sn içinde tamamlanamadı (sunucu {Host}:{Port}). Konu: {Subject}",
                SendTimeout.TotalSeconds, o.Smtp.Host, o.Smtp.Port, message.Subject);
            throw new SmtpException("SMTP zaman aşımı");
        }
        catch (SmtpException ex)
        {
            // Mesaj yalnızca SMTP sunucusunun cevabını içerir (şifre içermez); ayrıntı üst katmanda da loglanır.
            logger.LogError("SMTP gönderimi başarısız (sunucu {Host}:{Port}, durum {Status}, {Type}: {Reason}). Konu: {Subject}",
                o.Smtp.Host, o.Smtp.Port, ex.StatusCode, ex.InnerException?.GetType().Name ?? ex.GetType().Name,
                ex.InnerException?.Message ?? ex.Message, message.Subject);
            throw;
        }
        logger.LogInformation("E-posta gönderildi: {Subject}", message.Subject);
    }
}
