using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using PlanToBee.API.Infrastructure;
using PlanToBee.API.Models;
using PlanToBee.API.Services.Email;

namespace PlanToBee.API.Services;

// "Şifremi unuttum" ve hesap kilidi e-postaları: 6 haneli kod ve aynı işi yapan bağlantı. Kod ya da bağlantıyla yeni
// şifre belirlenince kalıcı kilit de açılır (AuthController.CompletePasswordResetAsync).
// - Gönderim arka plandadır (EmailQueue): cevap süresi hesabın var olup olmadığını ele vermez.
// - Adres başına en az 60 sn arayla, saatte en fazla 5 e-posta (Auth:PasswordReset:MinIntervalSeconds / MaxPerHour;
//   yalnızca testlerde gevşetilir). Kilit e-postası ile "Şifremi unuttum" aynı sınırı paylaşır; sınır aşılırsa e-posta
//   sessizce gönderilmez, istemciye giden cevap değişmez. Bu sınır kod denemesini de sınırlar (her kod 5 denemelik).
// - Kullanıcı başına tek geçerli kod vardır: yeni e-posta önceki kodu geçersiz kılar.
public class ResetEmails(UserManager<User> userManager, PasswordResetCodes codes, SendThrottle throttle, EmailQueue queue,
    IOptions<AppOptions> app, IConfiguration config)
{
    // locked: hesap bu denemeyle kilitlendi; e-posta uyarı ve kilit açma metniyle gider. Döner: e-posta kuyruğa yazıldı mı.
    public async Task<bool> QueueAsync(User user, bool locked)
    {
        if (!throttle.TryAcquire($"reset:{user.Id}", TimeSpan.FromHours(1),
                config.GetValue("Auth:PasswordReset:MaxPerHour", 5),
                TimeSpan.FromSeconds(config.GetValue("Auth:PasswordReset:MinIntervalSeconds", 60))))
            return false;

        var code = codes.Create(user.Id, await userManager.GetSecurityStampAsync(user));
        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        var link = app.Value.Link("reset-password", ("userId", user.Id), ("token", SecureCodes.EncodeForUrl(token)));
        var minutes = (int)PasswordResetCodes.Lifetime.TotalMinutes;
        return queue.TryEnqueue(locked
            ? EmailTemplates.AccountLocked(user.Email!, user.DisplayName, code, minutes, link)
            : EmailTemplates.ResetPassword(user.Email!, user.DisplayName, code, minutes, link));
    }
}
