using Microsoft.AspNetCore.Identity;
using PlanToBee.API.Models;

namespace PlanToBee.API.Services;

// Profil PIN'leri: 4 haneli, PBKDF2 ile özetlenmiş saklanır (PasswordHasher). Aile şifresini bilen biri
// ebeveyn profilini seçemesin diye ebeveyn profillerinde zorunludur. 5 hatalı denemede profil 5 dakika kilitlenir;
// kilit profil bazındadır, her cihaz için ayrı sayılmaz.
public class PinService
{
    public const int MaxAttempts = 5;
    public static readonly TimeSpan LockDuration = TimeSpan.FromMinutes(5);
    private static readonly PasswordHasher<FamilyMember> Hasher = new();

    public static bool IsValidFormat(string? pin) => pin is { Length: 4 } && pin.All(char.IsAsciiDigit);

    public static string Hash(FamilyMember member, string pin) => Hasher.HashPassword(member, pin);

    public enum Result { Ok, Wrong, Locked }

    // Çağıran taraf SaveChanges ile deneme sayacını kaydeder.
    public static Result Verify(FamilyMember member, string? pin, DateTime now, out TimeSpan lockRemaining)
    {
        lockRemaining = TimeSpan.Zero;
        if (member.PinLockedUntil is { } until && until > now)
        {
            lockRemaining = until - now;
            return Result.Locked;
        }
        if (member.PinHash != null && pin != null &&
            Hasher.VerifyHashedPassword(member, member.PinHash, pin) != PasswordVerificationResult.Failed)
        {
            member.FailedPinAttempts = 0;
            member.PinLockedUntil = null;
            return Result.Ok;
        }
        member.FailedPinAttempts++;
        if (member.FailedPinAttempts >= MaxAttempts)
        {
            member.FailedPinAttempts = 0;
            member.PinLockedUntil = now + LockDuration;
            lockRemaining = LockDuration;
            return Result.Locked;
        }
        return Result.Wrong;
    }
}
