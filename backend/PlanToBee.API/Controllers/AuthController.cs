using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using PlanToBee.API.DTOs;
using PlanToBee.API.Infrastructure;
using PlanToBee.API.Models;
using PlanToBee.API.Services;
using PlanToBee.API.Services.Email;

namespace PlanToBee.API.Controllers;

[ApiController]
[Route("api/auth")]
[EnableRateLimiting(RateLimitPolicies.Auth)]
public class AuthController(
    UserManager<User> userManager,
    SignInManager<User> signInManager,
    AuthTokenService tokens,
    IAppEmailSender emailSender,
    IOptions<AppOptions> app,
    SendThrottle throttle,
    MissingAccountLockout lockout,
    LoginChallenges challenges,
    PasswordResetCodes resetCodes,
    IConfiguration config,
    ILogger<AuthController> logger) : ControllerBase
{
    // Hesap varlığı belli olmaz: e-posta kayıtlı olsa da olmasa da cevap aynıdır ve oturum açılmaz.
    // - Yeni adres: hesap oluşturulur, doğrulama e-postası gider.
    // - Kayıtlı ama doğrulanmamış adres: doğrulama e-postası yeniden gider (şifre değişmez).
    // - Kayıtlı ve doğrulanmış adres: sahibine "bu adresle zaten hesabın var" e-postası gider.
    // Şifre kuralları hesap aranmadan önce kontrol edilir, böylece hata mesajları da iki durumda aynıdır.
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDto dto)
    {
        var displayName = (dto.DisplayName ?? dto.Username ?? "").Trim();
        if (displayName.Length == 0) return Err.BadRequest("validation", "Kullanıcı adını girin.");
        // Hesabın var olup olmadığından önce bakılır: eksik onay her adreste aynı hatayı verir.
        if (!dto.AcceptKvkk || !dto.AcceptTerms)
            return Err.BadRequest("consent_required", "Kayıt olmak için Aydınlatma Metni'ni okuduğunu onaylamalı ve Kullanım Koşulları'nı kabul etmelisin.");
        var email = dto.Email.Trim();
        var accepted = new RegisterAcceptedDto(
            "Kaydını tamamlamak için e-posta adresine bir bağlantı gönderdik. Bağlantıyı açtıktan sonra giriş yapabilirsin. " +
            "E-posta birkaç dakika içinde gelmezse gereksiz (spam) klasörüne bak.", email);

        var user = new User
        {
            UserName = email, Email = email, DisplayName = displayName, EmailConfirmed = false,
            IsKvkkChecked = true, IsTermsAccepted = true, ConsentsAcceptedAt = DateTime.UtcNow,
        };
        var passwordErrors = new List<IdentityError>();
        foreach (var validator in userManager.PasswordValidators)
        {
            var check = await validator.ValidateAsync(userManager, user, dto.Password);
            if (!check.Succeeded) passwordErrors.AddRange(check.Errors);
        }
        if (passwordErrors.Count > 0) return IdentityErrors(IdentityResult.Failed([.. passwordErrors]));

        var existing = await userManager.FindByEmailAsync(email);
        if (existing == null)
        {
            var result = await userManager.CreateAsync(user, dto.Password);
            if (result.Succeeded)
            {
                // Kayıt e-postası da gönderim sınırına sayılır: 60 sn içinde "tekrar gönder" sessizce atlanır.
                throttle.TryAcquire(VerifyThrottleKey(user), TimeSpan.FromHours(1), 5, TimeSpan.FromSeconds(60));
                await SendVerificationEmailAsync(user);
                return Ok(accepted);
            }
            if (!result.Errors.Any(e => e.Code is nameof(IdentityErrorDescriber.DuplicateEmail) or nameof(IdentityErrorDescriber.DuplicateUserName)))
                return IdentityErrors(result);
            // Eşzamanlı iki kayıt: diğeri önce oluşturdu.
            existing = await userManager.FindByEmailAsync(email);
            if (existing == null) return IdentityErrors(result);
        }

        // Yeni hesap yolundaki şifre özeti hesaplaması burada da yapılır; cevap süresi hesabı ele vermesin.
        userManager.PasswordHasher.HashPassword(existing, dto.Password);
        if (!existing.EmailConfirmed)
        {
            if (throttle.TryAcquire(VerifyThrottleKey(existing), TimeSpan.FromHours(1), 5, TimeSpan.FromSeconds(60)))
                await SendVerificationEmailAsync(existing);
        }
        else if (throttle.TryAcquire($"exists:{existing.Id}", TimeSpan.FromHours(1), 3, TimeSpan.FromSeconds(60)))
        {
            await SafeSend(EmailTemplates.AccountExists(existing.Email!, existing.DisplayName,
                app.Value.Link("login"), app.Value.Link("forgot-password")));
        }
        return Ok(accepted);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDto dto)
    {
        var email = dto.Email.Trim();
        var user = await userManager.FindByEmailAsync(email);
        if (user == null)
        {
            // Olmayan hesapta da aynı kilitlenme ve benzer cevap süresi: 429 hesabın varlığını ele vermez.
            userManager.PasswordHasher.HashPassword(new User(), dto.Password);
            return lockout.RegisterFailure(userManager.NormalizeEmail(email)) ? LockedOut() : InvalidCredentials();
        }

        // 5 hatalı denemede hesap kalıcı olarak kilitlenir (Program.cs, AuthLockout); kilitliyken doğru şifre de
        // reddedilir. Kilidi "Şifremi unuttum" akışı açar.
        var check = await signInManager.CheckPasswordSignInAsync(user, dto.Password, lockoutOnFailure: true);
        if (check.IsLockedOut) return LockedOut();
        if (!check.Succeeded) return InvalidCredentials();

        // İki adımlı doğrulama: şifre doğruysa oturum hemen açılmaz, e-postaya 6 haneli kod gider.
        // E-postası doğrulanmamış hesap kod alamaz (adres kanıtlanmadı) ve zaten hiçbir plan verisine erişemez;
        // o hesap eskisi gibi giriş yapar, aile ve plan uç noktaları 403 email_not_verified döner.
        if (user.EmailConfirmed && config.GetValue("Auth:EmailCode:Enabled", true))
            return await StartLoginCodeAsync(user);

        return Ok(await tokens.BuildAuthResponse(user));
    }

    // Giriş kodunu doğrular ve oturumu açar. Kod tek kullanımlıktır; 5 hatalı denemede challenge iptal edilir.
    [HttpPost("login/verify")]
    public async Task<IActionResult> VerifyLoginCode(VerifyLoginCodeDto dto)
    {
        var code = new string(dto.Code.Where(char.IsDigit).ToArray());
        var (status, userId, stamp) = challenges.Verify(dto.ChallengeId, code);
        if (status == LoginChallenges.VerifyStatus.Wrong)
        {
            var left = challenges.AttemptsLeft(dto.ChallengeId);
            return Err.BadRequest("login_code_invalid", $"Kod hatalı. {left} deneme hakkın kaldı.");
        }
        if (status != LoginChallenges.VerifyStatus.Ok) return LoginCodeExpired();

        var user = await userManager.FindByIdAsync(userId!);
        // Kod verildikten sonra şifre değiştiyse (güvenlik damgası yenilenir) kod geçersizdir.
        if (user == null || await userManager.GetSecurityStampAsync(user) != stamp) return LoginCodeExpired();
        if (await userManager.IsLockedOutAsync(user)) return LockedOut();

        await userManager.ResetAccessFailedCountAsync(user);
        return Ok(await tokens.BuildAuthResponse(user));
    }

    // Aynı challenge için yeni kod gönderir (eski kod geçersiz olur). Adres başına dakikada 1, saatte 5 e-posta.
    [HttpPost("login/resend-code")]
    public async Task<IActionResult> ResendLoginCode(ResendLoginCodeDto dto)
    {
        var userId = challenges.UserOf(dto.ChallengeId);
        var user = userId == null ? null : await userManager.FindByIdAsync(userId);
        if (user == null) return LoginCodeExpired();

        if (!TryAcquireLoginCodeSlot(user))
            return Err.TooMany("Kısa süre önce kod gönderildi. Bir dakika bekleyip tekrar dene.");

        var code = challenges.Resend(dto.ChallengeId);
        if (code == null) return LoginCodeExpired();
        if (!await TrySendLoginCodeAsync(user, code)) return CodeNotSent();
        return Ok(new { message = "Yeni kod e-postana gönderildi." });
    }

    // Süresi dolan erişim belirteci yerine yenisini verir; yenileme belirteci de değişir.
    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh(RefreshTokenDto dto)
    {
        var (response, error) = await tokens.RefreshAsync(dto.RefreshToken);
        if (response != null) return Ok(response);
        return error == "refresh_retry"
            ? Err.Make(401, "refresh_retry", "Oturum başka bir sekmede yenilendi. Tekrar dene.")
            : Err.Make(401, "refresh_invalid", "Oturumun sona erdi. Tekrar giriş yap.");
    }

    // Çıkış: bu cihazın yenileme belirteci iptal edilir. Belirteç geçersiz olsa da 204 döner.
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(RefreshTokenDto dto)
    {
        await tokens.RevokeAsync(dto.RefreshToken);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    // Sınıf düzeyindeki Auth (IP başına 20/dk) sınırı yerine kullanıcı başına geniş Session sınırı.
    [EnableRateLimiting(RateLimitPolicies.Session)]
    public async Task<IActionResult> Me()
    {
        var user = await userManager.GetUserAsync(User);
        if (user == null) return Unauthorized();
        int? memberId = int.TryParse(User.FindFirst(AuthClaims.Member)?.Value, out var mid) ? mid : null;
        return Ok(new MeDto(user.Id, user.Email!, user.DisplayName, user.EmailConfirmed,
            await tokens.GetFamilySummary(user.Id), await tokens.GetProfileSummary(user.Id, memberId),
            user.IsKvkkChecked, user.IsTermsAccepted));
    }

    // Doğrulama bağlantısındaki userId ve token ile e-postayı doğrular. Oturum gerekmez.
    [HttpPost("verify-email")]
    public async Task<IActionResult> VerifyEmail(VerifyEmailDto dto)
    {
        var user = await userManager.FindByIdAsync(dto.UserId);
        var token = SecureCodes.DecodeFromUrl(dto.Token);
        if (user == null || token == null)
            return Err.BadRequest("verify_invalid", "Doğrulama bağlantısı geçersiz veya süresi dolmuş. Yeni bir doğrulama e-postası iste.");
        if (user.EmailConfirmed)
            return Ok(new { message = "E-posta adresin zaten doğrulanmış.", alreadyVerified = true });

        var result = await userManager.ConfirmEmailAsync(user, token);
        if (!result.Succeeded)
            return Err.BadRequest("verify_invalid", "Doğrulama bağlantısı geçersiz veya süresi dolmuş. Yeni bir doğrulama e-postası iste.");
        return Ok(new { message = "E-posta adresin doğrulandı.", alreadyVerified = false });
    }

    // Oturum açıksa e-posta gövdeden okunmaz; değilse gövdedeki e-posta kullanılır.
    // Hesabın varlığı dışarıya belli edilmez: her durumda aynı cevap döner.
    [HttpPost("resend-verification")]
    public async Task<IActionResult> ResendVerification([FromBody] ResendVerificationDto? dto)
    {
        const string message = "Hesabın varsa ve doğrulanmamışsa doğrulama e-postası gönderildi.";
        User? user = null;
        // Kimlik doğrulama ara katmanı geçerli bir Bearer token varsa User'ı anonim uç noktada da doldurur.
        var authenticated = User.Identity?.IsAuthenticated == true;
        if (authenticated)
            user = await userManager.GetUserAsync(User);
        if (user == null && !string.IsNullOrWhiteSpace(dto?.Email))
        {
            authenticated = false;
            user = await userManager.FindByEmailAsync(dto.Email.Trim());
        }

        if (user != null && !user.EmailConfirmed)
        {
            if (!throttle.TryAcquire(VerifyThrottleKey(user), TimeSpan.FromHours(1), 5, TimeSpan.FromSeconds(60)))
            {
                // Oturum açıksa hesap zaten biliniyor, 429 dönebilir. Oturumsuz istekte hesap varlığı
                // belli olmasın diye aynı 200 cevabı döner ve e-posta sessizce gönderilmez.
                if (authenticated)
                    return Err.TooMany("Kısa süre önce doğrulama e-postası gönderildi. Bir dakika bekleyip tekrar dene.");
                return Ok(new { message });
            }
            await SendVerificationEmailAsync(user);
        }
        return Ok(new { message });
    }

    // E-postaya 6 haneli kod (ekranda girilir) ve aynı işi yapan bağlantı gider. Kilitli hesap da bu yolla açılır.
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(EmailOnlyDto dto)
    {
        const string message = "Kayıtlı bir hesap varsa e-postana şifre sıfırlama kodu gönderildi.";
        var user = await userManager.FindByEmailAsync(dto.Email.Trim());
        if (user == null) return Ok(new { message });

        // Kötüye kullanım: adres başına dakikada 1, saatte en fazla 5 e-posta. Sınır aşılsa da cevap aynıdır.
        // Bu sınır kod denemesini de sınırlar: saatte en fazla 5 kod, her biri 5 denemelik.
        if (!throttle.TryAcquire($"reset:{user.Id}", TimeSpan.FromHours(1), ResetMaxPerHour, TimeSpan.FromSeconds(ResetMinIntervalSeconds)))
            return Ok(new { message });

        var code = resetCodes.Create(user.Id, await userManager.GetSecurityStampAsync(user));
        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        var link = app.Value.Link("reset-password", ("userId", user.Id), ("token", SecureCodes.EncodeForUrl(token)));
        await SafeSend(EmailTemplates.ResetPassword(user.Email!, user.DisplayName, code,
            (int)PasswordResetCodes.Lifetime.TotalMinutes, link));
        return Ok(new { message });
    }

    // "Şifremi unuttum" e-postasındaki kod + yeni şifre. Kod doğruysa şifre değişir, kalıcı kilit açılır, e-posta
    // doğrulanmış sayılır ve bütün oturumlar kapanır (bağlantılı akışla aynı sonuç).
    // Hesap varlığı belli olmaz: olmayan adres, süresi dolmuş ya da yanlış kod aynı reset_code_invalid hatasını verir.
    [HttpPost("reset-password/code")]
    public async Task<IActionResult> ResetPasswordWithCode(ResetPasswordWithCodeDto dto)
    {
        var user = await userManager.FindByEmailAsync(dto.Email.Trim());

        // Şifre kuralları koddan önce kontrol edilir: kuralları tutmayan şifre deneme hakkı yemez.
        // Olmayan hesapta da aynı kontrol yapılır, hata mesajları iki durumda aynı olsun.
        var passwordErrors = new List<IdentityError>();
        foreach (var validator in userManager.PasswordValidators)
        {
            var check = await validator.ValidateAsync(userManager, user ?? new User(), dto.NewPassword);
            if (!check.Succeeded) passwordErrors.AddRange(check.Errors);
        }
        if (passwordErrors.Count > 0) return IdentityErrors(IdentityResult.Failed([.. passwordErrors]));

        var code = new string(dto.Code.Where(char.IsDigit).ToArray());
        var stamp = user == null ? null : resetCodes.Consume(user.Id, code);
        // Kod verildikten sonra şifre değiştiyse (güvenlik damgası yenilenir) kod geçersizdir.
        if (user == null || stamp == null || await userManager.GetSecurityStampAsync(user) != stamp)
            return Err.BadRequest("reset_code_invalid",
                "Kod hatalı ya da süresi dolmuş. 5 hatalı denemede kod geçersiz olur; gerekirse yeni kod iste.");

        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        var result = await userManager.ResetPasswordAsync(user, token, dto.NewPassword);
        if (!result.Succeeded) return IdentityErrors(result);
        await CompletePasswordResetAsync(user);
        return Ok(new { message = "Şifren değiştirildi ve hesabın açıldı. Yeni şifrenle giriş yapabilirsin." });
    }

    // Bağlantıdaki userId + token ile yeni şifre belirler. Token 1 saat geçerlidir ve tek kullanımlıktır
    // (şifre değişince security stamp yenilenir; eski token'lar ve açık oturumlar geçersiz olur).
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordDto dto)
    {
        var user = await userManager.FindByIdAsync(dto.UserId);
        var token = SecureCodes.DecodeFromUrl(dto.Token);
        if (user == null || token == null)
            return Err.BadRequest("reset_invalid", "Şifre sıfırlama bağlantısı geçersiz, kullanılmış ya da süresi dolmuş. Yeni bir bağlantı iste.");

        var result = await userManager.ResetPasswordAsync(user, token, dto.NewPassword);
        if (!result.Succeeded)
        {
            if (result.Errors.Any(e => e.Code == nameof(IdentityErrorDescriber.InvalidToken)))
                return Err.BadRequest("reset_invalid", "Şifre sıfırlama bağlantısı geçersiz, kullanılmış ya da süresi dolmuş. Yeni bir bağlantı iste.");
            return IdentityErrors(result);
        }

        await CompletePasswordResetAsync(user);
        return Ok(new { message = "Şifren değiştirildi. Yeni şifrenle giriş yapabilirsin." });
    }

    // Şifre sıfırlandıktan sonra (kodla ya da bağlantıyla): kalıcı kilit açılır, oturumlar kapanır.
    private async Task CompletePasswordResetAsync(User user)
    {
        // Kod ya da bağlantı e-postaya gittiği için adresin sahibi olduğu kanıtlanmış olur.
        if (!user.EmailConfirmed)
        {
            user.EmailConfirmed = true;
            await userManager.UpdateAsync(user);
        }
        await userManager.ResetAccessFailedCountAsync(user);
        await userManager.SetLockoutEndDateAsync(user, null);
        // Bekleyen kod da kullanılamaz olsun (damga zaten değişti; bellekte de tutulmasın).
        resetCodes.Remove(user.Id);
        // Şifre değişti: bütün cihazlardaki oturumlar kapanır. Oturum açılmaz; kullanıcı yeni şifresiyle giriş yapar.
        await tokens.RevokeAllAsync(user.Id);
    }

    // Şifre sıfırlama e-postaları: varsayılan en az 60 sn arayla, saatte en fazla 5 (Auth:PasswordReset:MinIntervalSeconds /
    // MaxPerHour ile değişir; yalnızca testlerde gevşetilir).
    private int ResetMinIntervalSeconds => config.GetValue("Auth:PasswordReset:MinIntervalSeconds", 60);
    private int ResetMaxPerHour => config.GetValue("Auth:PasswordReset:MaxPerHour", 5);

    private async Task<IActionResult> StartLoginCodeAsync(User user)
    {
        // Gönderim sınırı kod denemesini de sınırlar: en fazla saatte 5 kod, her biri 5 denemelik.
        if (!TryAcquireLoginCodeSlot(user))
            return Err.TooMany("Kısa süre önce giriş kodu gönderildi. Bir dakika bekleyip tekrar dene.");

        var (id, code) = challenges.Create(user.Id, await userManager.GetSecurityStampAsync(user));
        if (!await TrySendLoginCodeAsync(user, code))
        {
            challenges.Remove(id);
            return CodeNotSent();
        }
        return Ok(new LoginCodeRequiredDto(true, id, MaskEmail(user.Email!),
            (int)LoginChallenges.Lifetime.TotalSeconds, LoginCodeMinIntervalSeconds));
    }

    private async Task<bool> TrySendLoginCodeAsync(User user, string code)
    {
        try
        {
            await emailSender.SendAsync(EmailTemplates.LoginCode(
                user.Email!, user.DisplayName, code, (int)LoginChallenges.Lifetime.TotalMinutes));
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Giriş kodu e-postası gönderilemedi");
            return false;
        }
    }

    // "ilker@gmail.com" -> "i***@gmail.com": kod ekranında hangi adrese gittiği anlaşılsın, tamamı görünmesin.
    private static string MaskEmail(string email)
    {
        var at = email.IndexOf('@');
        return at <= 0 ? "***" : $"{email[0]}***{email[at..]}";
    }

    // Giriş kodu e-postaları: varsayılan en az 60 sn arayla, saatte en fazla 5 (Auth:EmailCode:MinIntervalSeconds /
    // MaxPerHour ile değişir; yalnızca testlerde gevşetilir).
    private bool TryAcquireLoginCodeSlot(User user) =>
        throttle.TryAcquire(LoginCodeThrottleKey(user), TimeSpan.FromHours(1),
            config.GetValue("Auth:EmailCode:MaxPerHour", 5),
            TimeSpan.FromSeconds(LoginCodeMinIntervalSeconds));

    // İstemcideki "tekrar gönder" sayacı da bu süreyi kullanır.
    private int LoginCodeMinIntervalSeconds => config.GetValue("Auth:EmailCode:MinIntervalSeconds", 60);

    private static string LoginCodeThrottleKey(User user) => $"logincode:{user.Id}";

    private static ObjectResult LoginCodeExpired() =>
        Err.BadRequest("login_code_expired", "Kodun süresi doldu ya da çok fazla hatalı deneme yapıldı. Yeniden giriş yap.");

    private static ObjectResult CodeNotSent() =>
        Err.Make(503, "login_code_not_sent", "Giriş kodu gönderilemedi. Biraz sonra tekrar dene.");

    private static ObjectResult InvalidCredentials() => Err.Make(401, "invalid_credentials", "E-posta veya şifre hatalı.");
    private static ObjectResult LockedOut() => AuthLockout.LockedOut();

    private static string VerifyThrottleKey(User user) => $"verify:{user.Id}";

    private async Task SendVerificationEmailAsync(User user)
    {
        var token = await userManager.GenerateEmailConfirmationTokenAsync(user);
        var link = app.Value.Link("verify-email", ("userId", user.Id), ("token", SecureCodes.EncodeForUrl(token)));
        await SafeSend(EmailTemplates.VerifyEmail(user.Email!, user.DisplayName, link));
    }

    private async Task SafeSend(EmailMessage message)
    {
        try { await emailSender.SendAsync(message); }
        catch (Exception ex) { logger.LogError(ex, "E-posta gönderilemedi: {Subject}", message.Subject); }
    }

    private ObjectResult IdentityErrors(IdentityResult result)
    {
        var errors = result.Errors.ToList();
        // Kullanıcı adı = e-posta olduğundan yinelenen e-postada iki hata birden gelir; biri yeterli.
        if (errors.Any(e => e.Code == nameof(IdentityErrorDescriber.DuplicateEmail)))
            errors.RemoveAll(e => e.Code == nameof(IdentityErrorDescriber.DuplicateUserName));
        var messages = errors.Select(e => e.Description).ToList();
        return Err.BadRequest("validation", string.Join(" ", messages), messages);
    }
}
