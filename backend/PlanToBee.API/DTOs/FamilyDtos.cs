using System.ComponentModel.DataAnnotations;
using PlanToBee.API.Models;

namespace PlanToBee.API.DTOs;

public record FamilyNameDto(
    [Required(ErrorMessage = "Aile adı girin"), StringLength(100, ErrorMessage = "Aile adı en fazla 100 karakter olabilir")] string Name);

// Aile kurulurken hesap sahibinin profili de oluşturulur ve oturum bu profille açılır.
// RefreshToken verilirse eski (profilsiz) oturum kapatılır.
public record CreateFamilyDto(
    [Required(ErrorMessage = "Aile adı girin"), StringLength(100, ErrorMessage = "Aile adı en fazla 100 karakter olabilir")] string Name,
    [Required(ErrorMessage = "Adını girin"), StringLength(50, ErrorMessage = "Ad en fazla 50 karakter olabilir")] string ProfileName,
    [Required(ErrorMessage = "4 haneli PIN girin")] string Pin,
    [StringLength(100)] string? RefreshToken);

// LockedSeconds: profil hatalı PIN denemeleri yüzünden kilitliyse kalan süre.
public record ProfileDto(int Id, string DisplayName, string Role, bool HasPin, bool IsOwner, bool IsCurrent, int? LockedSeconds);

public record FamilyDto(
    int Id,
    string Name,
    DateTime CreatedAt,
    int MyProfileId,
    bool IAmParent,
    List<ProfileDto> Profiles);

// Profil seçimi:
// - PIN'li profil: Pin zorunlu.
// - PIN'i olmayan ebeveyn profili (eski kayıtlar): hesap şifresi (Password) + yeni PIN (NewPin) ile PIN belirlenir.
// - PIN'siz çocuk profili: yalnızca RefreshToken.
// RefreshToken verilirse eski oturum kapatılır; cevaptaki yeni belirteçler bu profile bağlıdır.
public record SelectProfileDto(
    [StringLength(100)] string? RefreshToken,
    [StringLength(4)] string? Pin,
    [StringLength(128)] string? Password,
    [StringLength(4)] string? NewPin);

public record CreateProfileDto(
    [Required(ErrorMessage = "Ad girin"), StringLength(50, ErrorMessage = "Ad en fazla 50 karakter olabilir")] string DisplayName,
    [Required(ErrorMessage = "Rol seçin")] FamilyRole? Role,
    [StringLength(4)] string? Pin);

public record UpdateProfileDto(
    [Required(ErrorMessage = "Ad girin"), StringLength(50, ErrorMessage = "Ad en fazla 50 karakter olabilir")] string DisplayName,
    [Required(ErrorMessage = "Rol seçin")] FamilyRole? Role,
    // Çocuk -> Ebeveyn değişiminde profilin PIN'i yoksa zorunlu.
    [StringLength(4)] string? Pin);

// Pin null: PIN kaldırılır (yalnızca çocuk profillerinde).
public record SetPinDto([StringLength(4)] string? Pin);
