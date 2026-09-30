namespace PlanToBee.API.Infrastructure;

public class AppOptions
{
    public const string Section = "App";

    // E-postadaki bağlantıların üretildiği frontend adresi (dev: http://localhost:5173)
    public string FrontendBaseUrl { get; set; } = "http://localhost:5173";

    public string Link(string path, params (string Key, string Value)[] query)
    {
        var qs = string.Join("&", query.Select(q => $"{Uri.EscapeDataString(q.Key)}={Uri.EscapeDataString(q.Value)}"));
        return $"{FrontendBaseUrl.TrimEnd('/')}/{path.TrimStart('/')}" + (qs.Length > 0 ? "?" + qs : "");
    }
}
