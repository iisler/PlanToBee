using System.ComponentModel.DataAnnotations;
using PlanToBee.API.Models;

namespace PlanToBee.API.DTOs;

public record FamilyNameDto(
    [Required(ErrorMessage = "Aile adı girin"), StringLength(100, ErrorMessage = "Aile adı en fazla 100 karakter olabilir")] string Name);

public record InviteMemberDto(
    [Required(ErrorMessage = "Ad girin"), StringLength(50, ErrorMessage = "Ad en fazla 50 karakter olabilir")] string DisplayName,
    [Required(ErrorMessage = "Rol seçin")] FamilyRole? Role,
    [Required(ErrorMessage = "E-posta girin"), EmailAddress(ErrorMessage = "Geçerli bir e-posta adresi girin"), StringLength(256)] string Email);

public record CreateProfileDto(
    [Required(ErrorMessage = "Ad girin"), StringLength(50, ErrorMessage = "Ad en fazla 50 karakter olabilir")] string DisplayName);

public record InviteProfileDto(
    [Required(ErrorMessage = "E-posta girin"), EmailAddress(ErrorMessage = "Geçerli bir e-posta adresi girin"), StringLength(256)] string Email);

public record ChangeRoleDto([Required(ErrorMessage = "Rol seçin")] FamilyRole? Role);

public record TransferAdminDto([Required] int? MemberId);

public record InvitationDto(
    int Id,
    int MemberId,
    string MemberName,
    string Email,
    string Role,
    string Status,          // Pending | Accepted | Expired | Cancelled
    DateTime ExpiresAt,
    DateTime LastSentAt,
    DateTime CreatedAt,
    string? InvitedBy,
    int? RemainingSeconds); // yalnızca Pending için

public record FamilyMemberDto(
    int Id,
    string DisplayName,
    string Role,            // Parent | Child
    string Status,          // NoAccount | Invited | Joined
    bool IsAdmin,
    bool HasAccount,
    bool IsMe,
    bool CanEdit,           // istek sahibi bu üyenin planına yazabilir mi
    string? Email,
    InvitationDto? Invitation); // en son davet (varsa)

public record FamilyDto(
    int Id,
    string Name,
    DateTime CreatedAt,
    int MyMemberId,
    bool IAmAdmin,
    string MyRole,
    List<FamilyMemberDto> Members);

// Davet bağlantısı / kodu: ya Token ya da Email + Code gönderilir.
public record InviteCredentialsDto(
    [StringLength(200)] string? Token,
    [StringLength(256)] string? Email,
    [StringLength(10)] string? Code);

public record AcceptNewDto(
    [StringLength(200)] string? Token,
    [StringLength(256)] string? Email,
    [StringLength(10)] string? Code,
    [Required(ErrorMessage = "Şifre girin"), StringLength(128, ErrorMessage = "Şifre en fazla 128 karakter olabilir")] string Password);

public record InvitationPreviewDto(
    string FamilyName,
    string DisplayName,
    string Role,
    string Email,
    string? InvitedBy,
    DateTime ExpiresAt,
    bool AccountExists);
