using System.Text;
using Microsoft.Extensions.Options;

namespace PlanToBee.API.Services.Email;

// Geliştirme ortamı için: e-postayı göndermez; içeriği (link ve kod dahil) konsola ve
// ayarlıysa Email:OutputDirectory klasörüne .txt dosyası olarak yazar.
// DİKKAT: Gizli linkleri loglar, üretimde kullanılmamalı.
public class LogEmailSender(IOptions<EmailOptions> options, ILogger<LogEmailSender> logger, IWebHostEnvironment env) : IAppEmailSender
{
    public async Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        var o = options.Value;
        logger.LogInformation("[E-POSTA] Kime: {To} | Konu: {Subject}\n{Body}", message.To, message.Subject, message.TextBody);

        if (string.IsNullOrWhiteSpace(o.OutputDirectory)) return;
        var dir = Path.IsPathRooted(o.OutputDirectory) ? o.OutputDirectory : Path.Combine(env.ContentRootPath, o.OutputDirectory);
        Directory.CreateDirectory(dir);
        var safeTo = new string(message.To.Select(c => char.IsLetterOrDigit(c) || c is '.' or '-' or '_' or '@' ? c : '_').ToArray());
        var file = Path.Combine(dir, $"{DateTime.UtcNow:yyyyMMdd-HHmmss-fff}_{safeTo}.txt");
        var content = new StringBuilder()
            .AppendLine($"From: {o.FromName} <{o.From}>")
            .AppendLine($"To: {message.To}")
            .AppendLine($"Subject: {message.Subject}")
            .AppendLine($"Date: {DateTime.UtcNow:O}")
            .AppendLine()
            .AppendLine(message.TextBody)
            .ToString();
        await File.WriteAllTextAsync(file, content, Encoding.UTF8, ct);
    }
}
