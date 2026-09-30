namespace PlanToBee.API.Services.Email;

public class EmailOptions
{
    public const string Section = "Email";

    // "Log" veya "Smtp"
    public string Provider { get; set; } = "Log";
    public string From { get; set; } = "no-reply@plantobee.local";
    public string FromName { get; set; } = "PlanToBee";
    // Log sağlayıcısında e-postaların yazılacağı klasör (boşsa yalnızca konsola yazılır)
    public string? OutputDirectory { get; set; }
    public SmtpOptions Smtp { get; set; } = new();
}

// Parola repoda tutulmaz: yerelde `dotnet user-secrets set "Email:Smtp:Password" ...`,
// sunucuda Email__Smtp__Password ortam değişkeni.
public class SmtpOptions
{
    public string? Host { get; set; }
    public int Port { get; set; } = 587;
    public bool EnableSsl { get; set; } = true;
    public string? Username { get; set; }
    public string? Password { get; set; }
}
