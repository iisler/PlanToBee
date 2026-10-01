using System.ComponentModel.DataAnnotations;

namespace PlanToBee.API.DTOs;

// Username eski istemciler için kabul edilir; DisplayName tercih edilir.
public record RegisterDto(
    [Required(ErrorMessage = "E-posta girin"), EmailAddress(ErrorMessage = "Geçerli bir e-posta adresi girin"), StringLength(256)] string Email,
    [Required(ErrorMessage = "Şifre girin"), StringLength(128, ErrorMessage = "Şifre en fazla 128 karakter olabilir")] string Password,
    [StringLength(50, ErrorMessage = "Ad en fazla 50 karakter olabilir")] string? DisplayName,
    [StringLength(50, ErrorMessage = "Ad en fazla 50 karakter olabilir")] string? Username);

public record LoginDto(
    [Required(ErrorMessage = "E-posta girin")] string Email,
    [Required(ErrorMessage = "Şifre girin")] string Password);

public record EmailOnlyDto([Required(ErrorMessage = "E-posta girin"), StringLength(256)] string Email);

public record VerifyEmailDto([Required] string UserId, [Required] string Token);

public record ResetPasswordDto(
    [Required] string UserId,
    [Required] string Token,
    [Required(ErrorMessage = "Yeni şifre girin"), StringLength(128, ErrorMessage = "Şifre en fazla 128 karakter olabilir")] string NewPassword);

public record FamilySummaryDto(int Id, string Name);

// Bu oturumda seçili profil. IsOwner: hesap sahibinin profili.
public record ProfileSummaryDto(int Id, string DisplayName, string Role, bool IsOwner);

// Token: kısa ömürlü erişim belirteci (Authorization: Bearer). RefreshToken: /auth/refresh ile yeni oturum almak için;
// her kullanımda değişir. ExpiresIn: erişim belirtecinin ömrü (saniye).
// Profile: bu cihazda seçili profil; null ise istemci "Kim kullanıyor?" ekranını gösterir (POST /profiles/{id}/select).
public record AuthResponseDto(
    string Token,
    string RefreshToken,
    int ExpiresIn,
    string Email,
    string DisplayName,
    string Username, // geriye dönük uyumluluk: DisplayName ile aynı
    bool EmailVerified,
    FamilySummaryDto? Family,
    ProfileSummaryDto? Profile);

public record MeDto(string UserId, string Email, string DisplayName, bool EmailVerified, FamilySummaryDto? Family, ProfileSummaryDto? Profile);

// Kayıt cevabı hesap zaten var olsa da aynıdır (hesap varlığı belli olmaz); oturum açılmaz.
public record RegisterAcceptedDto(string Message, string Email);

public record RefreshTokenDto([Required, StringLength(100)] string RefreshToken);

// Oturum açıksa Email gönderilmesi gerekmez.
public record ResendVerificationDto([StringLength(256)] string? Email);
