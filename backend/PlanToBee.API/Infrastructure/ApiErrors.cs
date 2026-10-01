using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;

namespace PlanToBee.API.Infrastructure;

// Yeni uç noktaların ortak hata gövdesi: { "code": "...", "message": "Türkçe mesaj" }
// code sabit, makine tarafından okunabilir; message kullanıcıya gösterilebilir.
public record ApiError(
    string Code,
    string Message,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IEnumerable<string>? Errors = null);

public static class Err
{
    public static ObjectResult Make(int status, string code, string message, IEnumerable<string>? errors = null) =>
        new(new ApiError(code, message, errors)) { StatusCode = status };

    public static ObjectResult BadRequest(string code, string message, IEnumerable<string>? errors = null) => Make(400, code, message, errors);
    public static ObjectResult Forbidden(string code, string message) => Make(403, code, message);
    public static ObjectResult NotFound(string code = "not_found", string message = "Kayıt bulunamadı.") => Make(404, code, message);
    public static ObjectResult Conflict(string code, string message) => Make(409, code, message);
    public static ObjectResult Gone(string code, string message) => Make(410, code, message);
    public static ObjectResult TooMany(string message = "Çok fazla istek. Biraz bekleyip tekrar dene.") => Make(429, "rate_limited", message);

    public static ObjectResult FamilyRequired() =>
        Forbidden("family_required", "Önce aileni oluşturmalısın.");
    public static ObjectResult ProfileRequired() =>
        Forbidden("profile_required", "Devam etmek için profilini seç.");
    public static ObjectResult ParentOnly() =>
        Forbidden("parent_only", "Bu işlemi yalnızca ebeveyn profili yapabilir.");
    public static ObjectResult ReadOnly() =>
        Forbidden("plan_read_only", "Bu kaydı yalnızca ekleyen kişi ya da bir ebeveyn değiştirebilir.");
}
