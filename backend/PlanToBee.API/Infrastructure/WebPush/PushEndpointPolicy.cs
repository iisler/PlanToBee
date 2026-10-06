namespace PlanToBee.API.Infrastructure.WebPush;

// Abonelik adresi (endpoint) yalnızca bilinen push servislerine izinlidir. Aksi halde sunucu, kullanıcının verdiği
// herhangi bir adrese istek atmaya zorlanabilirdi (SSRF). Yalnızca https, varsayılan port, bilinen alan adları.
public static class PushEndpointPolicy
{
    // Tam ad ya da "." ile başlayan son ek (alt alan adları için).
    private static readonly string[] Allowed =
    [
        "fcm.googleapis.com",            // Chrome, Edge (Android), Samsung Internet
        "android.googleapis.com",        // eski Chrome abonelikleri
        ".push.apple.com",               // Safari / iPhone (web.push.apple.com)
        "updates.push.services.mozilla.com", // Firefox
        ".notify.windows.com",           // Edge (Windows)
    ];

    // extraHosts: yalnızca geliştirme/test için (WebPush:TestEndpointHosts), örn. "localhost". Üretimde boştur.
    public static bool IsAllowed(string? endpoint, IReadOnlyCollection<string> extraHosts, out Uri? uri)
    {
        uri = null;
        if (string.IsNullOrWhiteSpace(endpoint) || endpoint.Length > 1000) return false;
        if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var u)) return false;
        if (!string.IsNullOrEmpty(u.UserInfo)) return false;
        var host = u.IdnHost.ToLowerInvariant();

        if (extraHosts.Contains(host, StringComparer.OrdinalIgnoreCase) && (u.Scheme == Uri.UriSchemeHttp || u.Scheme == Uri.UriSchemeHttps))
        {
            uri = u;
            return true;
        }
        if (u.Scheme != Uri.UriSchemeHttps || !u.IsDefaultPort) return false;
        var ok = Allowed.Any(a => a.StartsWith('.') ? host.EndsWith(a, StringComparison.Ordinal) && host.Length > a.Length : host == a);
        if (ok) uri = u;
        return ok;
    }
}
