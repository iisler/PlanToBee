using Microsoft.EntityFrameworkCore;
using PlanToBee.API.Data;
using PlanToBee.API.Models;

namespace PlanToBee.API.Infrastructure;

// Yönetici komutları: veritabanında şifreli duran e-posta adreslerini yöneticinin kendi bilgisayarında okur.
// İnternete açık bir uç nokta yoktur; okumak için hem veritabanı bağlantısı hem PersonalData__Key gerekir.
//
// Kullanım (backend/PlanToBee.API klasöründe):
//   dotnet run -- admin users                  Tüm kullanıcılar: ad, e-posta, doğrulama, aile
//   dotnet run -- admin find <e-posta>         Bu e-postayla kayıtlı kullanıcı var mı
//   dotnet run -- admin import-firebase <yedek.json> --email <aile hesabı> --profile <profil adı> [--dry-run] [--force]
//                                              Eski sürümün Firebase yedeğini aileye aktarır (Infrastructure/FirebaseImport.cs)
//
// Canlı veritabanı için bağlantı ve anahtar ortam değişkeniyle verilir (docs/DEPLOY.md > Yönetici komutları):
//   ConnectionStrings__Default='postgresql://...' PersonalData__Key='...' dotnet run -- admin users
// Verilmezse yerel geliştirme ayarları (appsettings.Development.json, user-secrets) kullanılır.
public static class AdminCli
{
    public static async Task<int> RunAsync(string[] args)
    {
        var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";
        var config = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile($"appsettings.{env}.json", optional: true)
            .AddUserSecrets<AppDbContext>(optional: true)
            .AddEnvironmentVariables()
            .Build();

        var raw = config.GetConnectionString("Default");
        var local = raw != null && (raw.Contains("localhost", StringComparison.OrdinalIgnoreCase) || raw.Contains("127.0.0.1"));
        var conn = DatabaseConnection.Build(raw, requireSsl: !local);
        var secret = PersonalDataProtector.ResolveSecret(config);
        if (conn.ConnectionString == null || secret == null)
        {
            foreach (var e in conn.Errors) Console.Error.WriteLine("Hata: " + e);
            if (secret == null) Console.Error.WriteLine("Hata: PersonalData__Key ayarlı değil (Render > plantobee-api > Environment).");
            return 1;
        }

        var protector = new PersonalDataProtector(secret);
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(conn.ConnectionString).Options;
        await using var db = new AppDbContext(options, protector);

        Console.Error.WriteLine($"Anahtar kimliği: {protector.KeyId}. Çıktı kişisel veri içerir; paylaşma ve saklama.");
        try
        {
            switch (args)
            {
                case ["users"]:
                    return await ListUsers(db, null);
                case ["find", var email]:
                    return await ListUsers(db, email.Trim().ToUpperInvariant());
                case ["import-firebase", var file, .. var rest]:
                {
                    var opts = ParseOptions(rest);
                    if (!opts.TryGetValue("email", out var owner) || !opts.TryGetValue("profile", out var profile))
                    {
                        Console.Error.WriteLine("Kullanım: admin import-firebase <yedek.json> --email <aile hesabı> --profile <profil adı> [--dry-run] [--force]");
                        return 2;
                    }
                    return await FirebaseImport.RunAsync(db, file, owner, profile, opts.ContainsKey("dry-run"), opts.ContainsKey("force"));
                }
                default:
                    Console.Error.WriteLine("Komutlar: admin users | admin find <e-posta> | admin import-firebase <yedek.json> --email <e-posta> --profile <ad>");
                    return 2;
            }
        }
        catch (System.Security.Cryptography.CryptographicException ex)
        {
            Console.Error.WriteLine("Hata: " + ex.Message);
            return 1;
        }
    }

    private static async Task<int> ListUsers(AppDbContext db, string? normalizedEmail)
    {
        // NormalizedEmail karşılaştırması değer dönüştürücüsüyle anahtarlı özete çevrilerek yapılır.
        var query = db.Users.AsNoTracking();
        if (normalizedEmail != null) query = query.Where(u => u.NormalizedEmail == normalizedEmail);
        var users = await query
            .Select(u => new
            {
                u.Id, u.DisplayName, u.Email, u.EmailConfirmed,
                Family = db.FamilyMembers.Where(m => m.UserId == u.Id && m.Status == MemberStatus.Active)
                    .Select(m => m.Family!.Name).FirstOrDefault(),
            })
            .OrderBy(u => u.DisplayName)
            .ToListAsync();

        if (users.Count == 0)
        {
            Console.WriteLine(normalizedEmail == null ? "Kullanıcı yok." : "Bu e-postayla kayıtlı kullanıcı yok.");
            return normalizedEmail == null ? 0 : 3;
        }
        Console.WriteLine($"{"Ad",-20} {"E-posta",-36} {"Doğrulandı",-10} Aile");
        foreach (var u in users)
            Console.WriteLine($"{Cut(u.DisplayName, 20),-20} {Cut(u.Email, 36),-36} {(u.EmailConfirmed ? "evet" : "hayır"),-10} {u.Family ?? "-"}");
        Console.WriteLine($"Toplam: {users.Count}");
        return 0;
    }

    // --ad değer ve --bayrak biçimindeki seçenekler.
    private static Dictionary<string, string> ParseOptions(string[] args)
    {
        var opts = new Dictionary<string, string>();
        for (var i = 0; i < args.Length; i++)
        {
            if (!args[i].StartsWith("--")) continue;
            var key = args[i][2..];
            var hasValue = i + 1 < args.Length && !args[i + 1].StartsWith("--");
            opts[key] = hasValue ? args[++i] : "true";
        }
        return opts;
    }

    private static string Cut(string? s, int max) => s == null ? "-" : s.Length <= max ? s : s[..(max - 1)] + "…";
}
