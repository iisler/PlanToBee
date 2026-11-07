using System.Net;
using PlanToBee.API.Infrastructure;

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

    // Kod "Şifremi unuttum" ekranında girilir (kalıcı giriş kilidini de açar); bağlantı aynı işi e-postadan yapar.
    public static EmailMessage ResetPassword(string to, string displayName, string code, int codeMinutes, string link) => Build(
        to,
        "PlanToBee: Şifre sıfırlama kodun",
        $"Merhaba {displayName},",
        [
            "Şifreni sıfırlamak için bir istek aldık. \"Şifremi unuttum\" ekranına aşağıdaki kodu girip yeni şifreni belirle. " +
            "Hesabın çok fazla hatalı deneme yüzünden kilitlendiyse yeni şifreni belirlediğinde kilit de açılır.",
            $"Kod {codeMinutes} dakika geçerlidir ve yalnızca bir kez kullanılabilir. " +
            "İstersen aşağıdaki bağlantıyla da yeni şifre belirleyebilirsin (1 saat geçerli)."
        ],
        ("Yeni şifre belirle", link),
        ("Şifre sıfırlama kodun:", code),
        "Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez. Bu kodu kimseyle paylaşma.");

    // Hatalı şifre denemeleriyle hesap kilitlendiği anda sahibine kendiliğinden gider: uyarı, kilit açma kodu ve bağlantısı.
    // Kod "Şifremi unuttum" (kilit açma) ekranında girilir; bağlantı aynı işi e-postadan yapar.
    public static EmailMessage AccountLocked(string to, string displayName, string code, int codeMinutes, string link) => Build(
        to,
        "PlanToBee: Hesabın kilitlendi",
        $"Merhaba {displayName},",
        [
            "Hesabına arka arkaya 5 kez hatalı şifreyle giriş denendi ve güvenliğin için hesabın kilitlendi.",
            "Bu denemeleri sen yapmadıysan endişelenme: doğru şifre ve e-postana gelen giriş kodu olmadan hesabına girilemez. " +
            "Yine de yeni bir şifre belirlemeni öneririz.",
            $"Kilidi açmak için \"Şifremi unuttum\" ekranına aşağıdaki kodu girip yeni şifreni belirle. Kod {codeMinutes} dakika " +
            "geçerlidir. İstersen aşağıdaki bağlantıyla da yeni şifre belirleyebilirsin (1 saat geçerli)."
        ],
        ("Kilidi aç ve yeni şifre belirle", link),
        ("Kilidi açma kodun:", code),
        "Bu kodu kimseyle paylaşma. Açık oturumların kilitten etkilenmez; yeni şifre belirleyince bütün cihazlarda yeniden giriş yapman gerekir.");

    // Kayıtlı ve doğrulanmış bir adresle yeniden kayıt olunmaya çalışıldığında hesabın sahibine gider.
    // Kayıt ekranı bu durumda da "e-posta gönderdik" der; hesabın varlığını yalnızca adresin sahibi öğrenir.
    public static EmailMessage AccountExists(string to, string displayName, string loginLink, string forgotLink) => Build(
        to,
        "PlanToBee: Bu adresle zaten bir hesabın var",
        $"Merhaba {displayName},",
        [
            "Bu e-posta adresiyle PlanToBee'ye yeniden kayıt olunmak istendi. Bu adresle zaten bir hesabın olduğu için yeni hesap açılmadı.",
            "Hesabına giriş yapmak için aşağıdaki bağlantıyı kullanabilirsin. Şifreni hatırlamıyorsan şu adresten yeni şifre belirleyebilirsin:",
            forgotLink
        ],
        ("Giriş yap", loginLink),
        null,
        "Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; hesabında bir değişiklik yapılmadı.");

    // Giriş doğrulama kodu (iki adımlı doğrulama). Bağlantı yok, yalnızca kod var.
    public static EmailMessage LoginCode(string to, string displayName, string code, int validMinutes) => Build(
        to,
        "PlanToBee: Giriş kodun",
        $"Merhaba {displayName},",
        [
            "PlanToBee hesabına giriş yapmak için aşağıdaki kodu kullan.",
            $"Kod {validMinutes} dakika geçerlidir ve yalnızca bir kez kullanılabilir."
        ],
        null,
        ("Giriş kodun:", code),
        "Giriş yapmaya çalışan sen değilsen bu e-postayı yok sayabilirsin ve şifreni değiştirmeni öneririz. Bu kodu kimseyle paylaşma.");

    private static EmailMessage Build(string to, string subject, string greeting, string[] paragraphs,
        (string Text, string Url)? button, (string Intro, string Code)? code, string footer)
    {
        var text = new System.Text.StringBuilder()
            .AppendLine(greeting).AppendLine();
        foreach (var p in paragraphs) text.AppendLine(p);
        if (code != null) text.AppendLine().AppendLine(code.Value.Intro).AppendLine(code.Value.Code);
        if (button != null) text.AppendLine().AppendLine($"{button.Value.Text}: {button.Value.Url}");
        text.AppendLine().AppendLine(footer).AppendLine().AppendLine("PlanToBee");

        string H(string s) => WebUtility.HtmlEncode(s);
        var html = new System.Text.StringBuilder()
            .Append("<div style=\"font-family:Arial,sans-serif;font-size:15px;color:#222\">")
            .Append($"<p>{H(greeting)}</p>");
        foreach (var p in paragraphs) html.Append($"<p>{H(p)}</p>");
        if (code != null)
            html.Append($"<p>{H(code.Value.Intro)}</p><p style=\"font-size:24px;letter-spacing:4px;font-weight:bold\">{H(code.Value.Code)}</p>");
        if (button != null)
            html.Append($"<p><a href=\"{H(button.Value.Url)}\" style=\"display:inline-block;padding:10px 18px;background:#F6B51E;color:#1E1A14;font-weight:bold;text-decoration:none;border-radius:6px\">{H(button.Value.Text)}</a></p>")
                .Append($"<p style=\"font-size:12px;color:#666\">Buton çalışmazsa bu adresi tarayıcına yapıştır:<br>{H(button.Value.Url)}</p>");
        html.Append($"<p style=\"font-size:12px;color:#666\">{H(footer)}</p><p>PlanToBee</p></div>");

        return new EmailMessage(to, subject, text.ToString(), html.ToString());
    }
}
