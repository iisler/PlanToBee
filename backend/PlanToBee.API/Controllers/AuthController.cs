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
        if (displayName.Length == 0) return Err.BadRequest("validation", "Adını girin.");
        var email = dto.Email.Trim();
        var accepted = new RegisterAcceptedDto(
            "Kaydını tamamlamak için e-posta adresine bir bağlantı gönderdik. Bağlantıyı açtıktan sonra giriş yapabilirsin. " +
            "E-posta birkaç dakika içinde gelmezse gereksiz (spam) klasörüne bak.", email);

        var user = new User { UserName = email, Email = email, DisplayName = displayName, EmailConfirmed = false };
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

        // Hatalı denemelerde hesap geçici olarak kilitlenir (Program.cs: 5 deneme / 5 dk).
        var check = await signInManager.CheckPasswordSignInAsync(user, dto.Password, lockoutOnFailure: true);
        if (check.IsLockedOut) return LockedOut();
        if (!check.Succeeded) return InvalidCredentials();

        // Doğrulanmamış kullanıcı da token alır; ancak aile ve plan uç noktaları 403 email_not_verified döner.
        return Ok(await tokens.BuildAuthResponse(user));
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
        return Ok(new MeDto(user.Id, user.Email!, user.DisplayName, user.EmailConfirmed, await tokens.GetFamilySummary(user.Id)));
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

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(EmailOnlyDto dto)
    {
        const string message = "Kayıtlı bir hesap varsa şifre sıfırlama e-postası gönderildi.";
        var user = await userManager.FindByEmailAsync(dto.Email.Trim());
        if (user == null) return Ok(new { message });

        // Kötüye kullanım: adres başına dakikada 1, saatte en fazla 5 e-posta. Sınır aşılsa da cevap aynıdır.
        if (!throttle.TryAcquire($"reset:{user.Id}", TimeSpan.FromHours(1), 5, TimeSpan.FromSeconds(60)))
            return Ok(new { message });

        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        var link = app.Value.Link("reset-password", ("userId", user.Id), ("token", SecureCodes.EncodeForUrl(token)));
        await SafeSend(EmailTemplates.ResetPassword(user.Email!, user.DisplayName, link));
        return Ok(new { message });
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

        // Bağlantı e-postaya gittiği için adresin sahibi olduğu kanıtlanmış olur.
        if (!user.EmailConfirmed)
        {
            user.EmailConfirmed = true;
            await userManager.UpdateAsync(user);
        }
        await userManager.ResetAccessFailedCountAsync(user);
        await userManager.SetLockoutEndDateAsync(user, null);
        // Şifre değişti: diğer cihazlardaki oturumlar da yenilenemez olsun.
        await tokens.RevokeAllAsync(user.Id);
        return Ok(await tokens.BuildAuthResponse(user));
    }

    private static ObjectResult InvalidCredentials() => Err.Make(401, "invalid_credentials", "E-posta veya şifre hatalı.");
    private static ObjectResult LockedOut() =>
        Err.Make(429, "locked_out", "Çok fazla hatalı giriş denemesi. Birkaç dakika sonra tekrar dene.");

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
