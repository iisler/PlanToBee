using System.Net;
using System.Net.Http.Headers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PlanToBee.API.Data;
using PlanToBee.API.Infrastructure.WebPush;

namespace PlanToBee.API.Services.Notifications;

// Bir profilin tüm cihazlarına şifreli bildirim gönderir (Web Push). Push servisi aboneliğin artık geçersiz
// olduğunu söylerse (404/410) ya da sunucu anahtarı değiştiği için reddederse (401/403) abonelik silinir.
public class PushSender(AppDbContext db, IHttpClientFactory http, VapidKey vapid, IOptions<WebPushOptions> options,
    ILogger<PushSender> logger)
{
    public const string HttpClientName = "webpush";

    // Gönderilen cihaz sayısını döner.
    public async Task<int> SendToMemberAsync(int memberId, PushMessage message, CancellationToken ct = default)
    {
        var subs = await db.PushSubscriptions.Where(s => s.MemberId == memberId).ToListAsync(ct);
        if (subs.Count == 0) return 0;
        // İçerik her cihaz için ayrı şifrelenir; JSON bir kez üretilir.
        var payload = message.ToJson();
        var client = http.CreateClient(HttpClientName);
        var sent = 0;
        foreach (var sub in subs)
        {
            if (!PushEndpointPolicy.IsAllowed(sub.Endpoint, options.Value.TestEndpointHosts, out var endpoint))
            {
                db.PushSubscriptions.Remove(sub);
                continue;
            }
            try
            {
                var body = WebPushCrypto.Encrypt(payload, Base64Url.Decode(sub.P256dh), Base64Url.Decode(sub.Auth));
                using var req = new HttpRequestMessage(HttpMethod.Post, endpoint) { Content = new ByteArrayContent(body) };
                req.Content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
                req.Content.Headers.ContentEncoding.Add("aes128gcm");
                req.Headers.TryAddWithoutValidation("Authorization", vapid.AuthorizationHeader(endpoint!, DateTimeOffset.UtcNow));
                // Cihaz kapalıysa push servisi bildirimi en fazla 1 gün saklar.
                req.Headers.Add("TTL", "86400");
                req.Headers.Add("Urgency", "normal");
                using var res = await client.SendAsync(req, ct);
                if (res.IsSuccessStatusCode)
                {
                    sub.LastSuccessAt = DateTime.UtcNow;
                    sent++;
                }
                else if (res.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Gone or HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
                {
                    logger.LogInformation("Bildirim aboneliği geçersiz ({Status}), siliniyor: {Id}", (int)res.StatusCode, sub.Id);
                    db.PushSubscriptions.Remove(sub);
                }
                else
                {
                    logger.LogWarning("Bildirim gönderilemedi ({Status}) abonelik {Id}", (int)res.StatusCode, sub.Id);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                logger.LogWarning(ex, "Bildirim gönderilemedi, abonelik {Id}", sub.Id);
            }
        }
        // Gönderim sırasında abonelik silinmiş olabilir (profil ya da hesap silindi); güncellenemeyen satır yok sayılır,
        // dağıtıcının sıradaki alıcılara göndermesi kesilmez.
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            logger.LogInformation("Bildirim aboneliği gönderim sırasında silinmiş; durum güncellenmedi.");
        }
        return sent;
    }
}
