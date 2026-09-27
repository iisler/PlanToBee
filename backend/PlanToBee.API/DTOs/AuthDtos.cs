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

public record FamilySummaryDto(int Id, string Name, int MemberId, string DisplayName, string Role, bool IsAdmin);

public record AuthResponseDto(
    string Token,
    string Email,
    string DisplayName,
    string Username, // geriye dönük uyumluluk: DisplayName ile aynı
    bool EmailVerified,
    FamilySummaryDto? Family);

public record MeDto(string UserId, string Email, string DisplayName, bool EmailVerified, FamilySummaryDto? Family);

// Oturum açıksa Email gönderilmesi gerekmez.
public record ResendVerificationDto([StringLength(256)] string? Email);
