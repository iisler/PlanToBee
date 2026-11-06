using Microsoft.AspNetCore.Identity;

namespace PlanToBee.API.Infrastructure;

// Identity'nin uzunluk / harf / rakam / sembol kurallarına ek olarak tahmin edilmesi kolay dizileri reddeder
// (Program.cs'te AddPasswordValidator ile eklenir; kayıt ve şifre sıfırlamada çalışır):
// - Aynı karakter art arda MaxRun kez ya da daha fazla: "111", "aaa", "!!!"
// - Art arda artan ya da azalan MaxRun rakam veya harf: "123", "987", "abc", "CBA"
// Harflerde büyük/küçük ayrımı yapılmaz ("aAa" ve "aBc" de reddedilir). Sıra İngiliz alfabesine göredir.
// İstemcideki karşılığı: frontend/src/utils/passwordPolicy.js
public class PasswordPatternValidator<TUser> : IPasswordValidator<TUser> where TUser : class
{
    public const int MaxRun = 3;

    public Task<IdentityResult> ValidateAsync(UserManager<TUser> manager, TUser user, string? password)
    {
        var errors = new List<IdentityError>();
        if (!string.IsNullOrEmpty(password))
        {
            if (HasRepeatedRun(password))
                errors.Add(new IdentityError
                {
                    Code = "PasswordRepeatedChars",
                    Description = $"Şifrede aynı karakter art arda {MaxRun} kez kullanılamaz (ör. 111, aaa).",
                });
            if (HasSequentialRun(password))
                errors.Add(new IdentityError
                {
                    Code = "PasswordSequentialChars",
                    Description = $"Şifrede art arda {MaxRun} ardışık rakam ya da harf kullanılamaz (ör. 123, 321, abc).",
                });
        }
        return Task.FromResult(errors.Count == 0 ? IdentityResult.Success : IdentityResult.Failed([.. errors]));
    }

    public static bool HasRepeatedRun(string password)
    {
        var run = 1;
        for (var i = 1; i < password.Length; i++)
        {
            run = char.ToLowerInvariant(password[i]) == char.ToLowerInvariant(password[i - 1]) ? run + 1 : 1;
            if (run >= MaxRun) return true;
        }
        return false;
    }

    public static bool HasSequentialRun(string password)
    {
        int up = 1, down = 1;
        for (var i = 1; i < password.Length; i++)
        {
            var (a, b) = (char.ToLowerInvariant(password[i - 1]), char.ToLowerInvariant(password[i]));
            var sameKind = (IsDigit(a) && IsDigit(b)) || (IsLetter(a) && IsLetter(b));
            up = sameKind && b == a + 1 ? up + 1 : 1;
            down = sameKind && b == a - 1 ? down + 1 : 1;
            if (up >= MaxRun || down >= MaxRun) return true;
        }
        return false;
    }

    private static bool IsDigit(char c) => c is >= '0' and <= '9';
    private static bool IsLetter(char c) => c is >= 'a' and <= 'z';
}
