using Microsoft.AspNetCore.Identity;

namespace PlanToBee.API.Data;

// ASP.NET Identity hata mesajlarının Türkçesi (kayıt ve şifre sıfırlama ekranında kullanıcıya gösterilir).
public class TurkishIdentityErrorDescriber : IdentityErrorDescriber
{
    public override IdentityError DefaultError() => new() { Code = nameof(DefaultError), Description = "Bilinmeyen bir hata oluştu." };
    public override IdentityError DuplicateEmail(string email) => new() { Code = nameof(DuplicateEmail), Description = $"'{email}' ile zaten bir hesap var." };
    public override IdentityError DuplicateUserName(string userName) => new() { Code = nameof(DuplicateUserName), Description = $"'{userName}' kullanıcı adı alınmış." };
    public override IdentityError InvalidEmail(string? email) => new() { Code = nameof(InvalidEmail), Description = $"'{email}' geçerli bir e-posta adresi değil." };
    public override IdentityError InvalidUserName(string? userName) => new() { Code = nameof(InvalidUserName), Description = $"'{userName}' kullanıcı adı olarak kullanılamaz. Harf, rakam, boşluk ve - . _ kullanabilirsin." };
    public override IdentityError InvalidToken() => new() { Code = nameof(InvalidToken), Description = "Geçersiz veya süresi dolmuş istek." };
    public override IdentityError PasswordMismatch() => new() { Code = nameof(PasswordMismatch), Description = "Şifre hatalı." };
    public override IdentityError PasswordTooShort(int length) => new() { Code = nameof(PasswordTooShort), Description = $"Şifre en az {length} karakter olmalı." };
    public override IdentityError PasswordRequiresUniqueChars(int uniqueChars) => new() { Code = nameof(PasswordRequiresUniqueChars), Description = $"Şifrede en az {uniqueChars} farklı karakter olmalı." };
    public override IdentityError PasswordRequiresNonAlphanumeric() => new() { Code = nameof(PasswordRequiresNonAlphanumeric), Description = "Şifrede en az bir sembol olmalı." };
    public override IdentityError PasswordRequiresDigit() => new() { Code = nameof(PasswordRequiresDigit), Description = "Şifrede en az bir rakam olmalı." };
    public override IdentityError PasswordRequiresLower() => new() { Code = nameof(PasswordRequiresLower), Description = "Şifrede en az bir küçük harf olmalı." };
    public override IdentityError PasswordRequiresUpper() => new() { Code = nameof(PasswordRequiresUpper), Description = "Şifrede en az bir büyük harf olmalı." };
}
