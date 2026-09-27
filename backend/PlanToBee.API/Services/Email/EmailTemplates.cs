using System.Net;

namespace PlanToBee.API.Services.Email;

// Türkçe e-posta şablonları. Kullanıcıdan gelen metinler (ad, aile adı) HTML'de kodlanır.
public static class EmailTemplates
{
    public static EmailMessage VerifyEmail(string to, string displayName, string link) => Build(
        to,
        "PlanToBee: E-posta adresini doğrula",
        $"Merhaba {displayName},",
        [
            "PlanToBee hesabını kullanmaya başlamak için e-posta adresini doğrulaman gerekiyor.",
            "Aşağıdaki bağlantı 2 gün geçerlidir."
        ],
        ("E-postamı doğrula", link),
        null,
        "Bu hesabı sen oluşturmadıysan bu e-postayı yok sayabilirsin.");

    public static EmailMessage ResetPassword(string to, string displayName, string link) => Build(
        to,
        "PlanToBee: Şifre sıfırlama",
        $"Merhaba {displayName},",
        [
            "Şifreni sıfırlamak için bir istek aldık. Yeni şifreni belirlemek için aşağıdaki bağlantıyı kullan.",
            "Bağlantı 1 saat geçerlidir ve yalnızca bir kez kullanılabilir."
        ],
        ("Yeni şifre belirle", link),
        null,
        "Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.");

    public static EmailMessage Invitation(string to, string memberName, string familyName, string inviterName,
        string roleText, string link, string code, DateTime expiresAtUtc) => Build(
        to,
        $"PlanToBee: {inviterName} seni {familyName} ailesine davet etti",
        $"Merhaba {memberName},",
        [
            $"{inviterName}, seni PlanToBee'de \"{familyName}\" ailesine {roleText} olarak davet etti.",
            "Katılmak için aşağıdaki bağlantıya tıklayıp şifreni belirlemen yeterli.",
            $"Davet {expiresAtUtc:dd.MM.yyyy HH:mm} (UTC) tarihine kadar, yani 7 gün geçerlidir ve tek kullanımlıktır."
        ],
        ("Daveti kabul et", link),
        ("Bağlantı çalışmazsa PlanToBee giriş ekranında \"Davet kodum var\" seçeneğine bu e-posta adresini ve şu kodu gir:", code),
        "Bu daveti beklemiyorsan e-postayı yok sayabilirsin.");

    private static EmailMessage Build(string to, string subject, string greeting, string[] paragraphs,
        (string Text, string Url) button, (string Intro, string Code)? code, string footer)
    {
        var text = new System.Text.StringBuilder()
            .AppendLine(greeting).AppendLine();
        foreach (var p in paragraphs) text.AppendLine(p);
        text.AppendLine().AppendLine($"{button.Text}: {button.Url}");
        if (code != null) text.AppendLine().AppendLine(code.Value.Intro).AppendLine(code.Value.Code);
        text.AppendLine().AppendLine(footer).AppendLine().AppendLine("PlanToBee");

        string H(string s) => WebUtility.HtmlEncode(s);
        var html = new System.Text.StringBuilder()
            .Append("<div style=\"font-family:Arial,sans-serif;font-size:15px;color:#222\">")
            .Append($"<p>{H(greeting)}</p>");
        foreach (var p in paragraphs) html.Append($"<p>{H(p)}</p>");
        html.Append($"<p><a href=\"{H(button.Url)}\" style=\"display:inline-block;padding:10px 18px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px\">{H(button.Text)}</a></p>")
            .Append($"<p style=\"font-size:12px;color:#666\">Buton çalışmazsa bu adresi tarayıcına yapıştır:<br>{H(button.Url)}</p>");
        if (code != null)
            html.Append($"<p>{H(code.Value.Intro)}</p><p style=\"font-size:24px;letter-spacing:4px;font-weight:bold\">{H(code.Value.Code)}</p>");
        html.Append($"<p style=\"font-size:12px;color:#666\">{H(footer)}</p><p>PlanToBee</p></div>");

        return new EmailMessage(to, subject, text.ToString(), html.ToString());
    }
}
