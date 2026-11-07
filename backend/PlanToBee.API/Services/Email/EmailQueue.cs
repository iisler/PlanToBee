using System.Threading.Channels;

namespace PlanToBee.API.Services.Email;

// Arka planda gönderilecek e-postalar. Hesap kilidi ve "Şifremi unuttum" e-postaları isteği bekletmeden kuyruğa yazılır:
// SMTP gönderimi (yaklaşık 1 sn) cevap süresine eklenmez, böylece cevap süresi hesabın var olup olmadığını ele vermez.
// Bellek içidir (tek sunucu örneği). Sunucu kapanırken kuyrukta kalan e-posta gönderilmez; kullanıcı yenisini ister.
public class EmailQueue
{
    private readonly Channel<EmailMessage> _channel = Channel.CreateBounded<EmailMessage>(
        new BoundedChannelOptions(500) { FullMode = BoundedChannelFullMode.DropWrite, SingleReader = true });

    // Kuyruk doluysa (aşırı yük) e-posta düşer ve false döner.
    public bool TryEnqueue(EmailMessage message) => _channel.Writer.TryWrite(message);

    public IAsyncEnumerable<EmailMessage> ReadAllAsync(CancellationToken ct) => _channel.Reader.ReadAllAsync(ct);
}

// Kuyruktaki e-postaları sırayla gönderir. Gönderim hatası loglanır (gövde, kod ya da bağlantı yazılmaz), sıradakine geçilir.
public class EmailQueueWorker(EmailQueue queue, IServiceScopeFactory scopes, ILogger<EmailQueueWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var message in queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<IAppEmailSender>().SendAsync(message, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "E-posta gönderilemedi: {Subject}", message.Subject);
            }
        }
    }
}
