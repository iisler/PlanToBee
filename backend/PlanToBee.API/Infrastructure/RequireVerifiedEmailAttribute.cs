using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace PlanToBee.API.Infrastructure;

public static class AuthClaims
{
    public const string SecurityStamp = "sstamp";
    // Her istekte veritabanından okunur (Program.cs OnTokenValidated), token'a gömülü değildir.
    public const string EmailVerified = "email_verified";
    // Bu oturumda seçili profil (FamilyMember.Id). Profil seçilmeden önce verilen belirteçte yoktur.
    public const string Member = "mid";
}

// E-postası doğrulanmamış kullanıcıyı aile ve plan uç noktalarından 403 email_not_verified ile geri çevirir.
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class RequireVerifiedEmailAttribute : Attribute, IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;
        if (user.Identity?.IsAuthenticated != true) return; // [Authorize] 401 döner
        if (user.FindFirst(AuthClaims.EmailVerified)?.Value != "true")
            context.Result = Err.Forbidden("email_not_verified", "Devam etmek için e-posta adresini doğrulamalısın.");
    }
}
