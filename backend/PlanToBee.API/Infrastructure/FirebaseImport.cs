using System.Globalization;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PlanToBee.API.Data;
using PlanToBee.API.Models;

namespace PlanToBee.API.Infrastructure;

// Eski tek dosyalık sürümün (kökteki index.html) Firebase Realtime Database yedeğini bir aileye aktarır.
// Yedek, Firebase konsolundan indirilen JSON'dur (Realtime Database > Veri > ⋮ > JSON'u dışa aktar):
//   { "subjects": [...], "days": { "2026-09-28": { "studyEntries": [...], "training": [...], "events": [...] } }, ... }
// Kayıtlar seçilen profil adına, "aktarıldı" (IsImported) işaretiyle eklenir; aynı günde mevcut kayıtlar korunur.
// Aile planında daha önce aktarılmış kayıt varsa aktarım --force verilmedikçe yapılmaz (iki kez aktarılmasın).
public static class FirebaseImport
{
    private static readonly CultureInfo Tr = new("tr-TR");
    private static readonly string[] Statuses = ["todo", "inprogress", "done"];

    public record Summary(int Days, int Study, int Training, int Events, int SubjectsAdded, List<string> Skipped);

    public static async Task<int> RunAsync(AppDbContext db, string file, string ownerEmail, string profileName, bool dryRun, bool force)
    {
        if (!File.Exists(file)) return Fail($"Dosya bulunamadı: {file}");
        JsonNode? root;
        try { root = JsonNode.Parse(await File.ReadAllTextAsync(file)); }
        catch (Exception ex) { return Fail($"JSON okunamadı: {ex.Message}"); }
        if (root is not JsonObject) return Fail("JSON'un en üstünde bir nesne bekleniyordu (Firebase veritabanının tamamı).");

        // NormalizedEmail sorgusu değer dönüştürücüsüyle anahtarlı özete çevrilerek yapılır.
        var normalized = ownerEmail.Trim().ToUpperInvariant();
        var owner = await db.Users.FirstOrDefaultAsync(u => u.NormalizedEmail == normalized);
        if (owner == null) return Fail($"Bu e-postayla hesap yok: {ownerEmail}");
        var familyId = await db.FamilyMembers
            .Where(m => m.UserId == owner.Id && m.Status == MemberStatus.Active)
            .Select(m => (int?)m.FamilyId).FirstOrDefaultAsync();
        if (familyId == null) return Fail("Bu hesabın ailesi yok. Önce uygulamada aileyi kur.");
        var profiles = await db.FamilyMembers.Where(m => m.FamilyId == familyId && m.Status == MemberStatus.Active).ToListAsync();
        var profile = profiles.FirstOrDefault(p => string.Compare(p.DisplayName.Trim(), profileName.Trim(), Tr, CompareOptions.IgnoreCase) == 0);
        if (profile == null)
            return Fail($"\"{profileName}\" adlı profil yok. Profiller: {string.Join(", ", profiles.Select(p => p.DisplayName))}");

        var alreadyImported =
            await db.StudyEntries.AnyAsync(e => e.IsImported && e.Day!.FamilyId == familyId) ||
            await db.TrainingEntries.AnyAsync(e => e.IsImported && e.Day!.FamilyId == familyId) ||
            await db.Events.AnyAsync(e => e.IsImported && e.Day!.FamilyId == familyId);
        if (alreadyImported && !force)
            return Fail("Bu ailenin planında daha önce aktarılmış kayıtlar var. İki kez aktarmamak için durduruldu. " +
                        "Bilerek tekrar aktarmak istiyorsan --force ekle (kayıtlar çoğalır).");

        await using var tx = await db.Database.BeginTransactionAsync();
        var summary = await Import(db, (JsonObject)root, familyId.Value, profile.Id);
        if (dryRun) await tx.RollbackAsync();
        else await tx.CommitAsync();

        Console.WriteLine(dryRun ? "DENEME (hiçbir şey kaydedilmedi):" : "Aktarım tamamlandı:");
        Console.WriteLine($"  Aile planı, ekleyen profil: {profile.DisplayName}");
        Console.WriteLine($"  Gün: {summary.Days}, ders: {summary.Study}, antrenman: {summary.Training}, etkinlik: {summary.Events}, " +
                          $"ders listesine eklenen: {summary.SubjectsAdded}");
        if (summary.Skipped.Count > 0)
        {
            Console.WriteLine($"  Atlanan {summary.Skipped.Count} kayıt:");
            foreach (var s in summary.Skipped.Take(30)) Console.WriteLine("   - " + s);
            if (summary.Skipped.Count > 30) Console.WriteLine($"   … ve {summary.Skipped.Count - 30} kayıt daha");
        }
        return 0;
    }

    private static async Task<Summary> Import(AppDbContext db, JsonObject root, int familyId, int profileId)
    {
        var now = DateTime.UtcNow;
        var skipped = new List<string>();
        int days = 0, study = 0, training = 0, events = 0, subjectsAdded = 0;

        // Ders listesi: ailede olmayan adlar eklenir (Türkçe büyük/küçük harf duyarsız).
        var existing = await db.Subjects.Where(s => s.FamilyId == familyId).Select(s => s.Name).ToListAsync();
        foreach (var name in Items(root["subjects"]).Select(n => Text(n, 100)).Where(n => n.Length > 0))
        {
            if (existing.Any(e => string.Compare(e.Trim(), name, Tr, CompareOptions.IgnoreCase) == 0)) continue;
            db.Subjects.Add(new Subject { FamilyId = familyId, Name = name, CreatedByMemberId = profileId, CreatedAt = now, IsImported = true });
            existing.Add(name);
            subjectsAdded++;
        }

        if (root["days"] is JsonObject dayMap)
        {
            foreach (var (key, node) in dayMap.OrderBy(kv => kv.Key, StringComparer.Ordinal))
            {
                if (!DateOnly.TryParseExact(key, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
                {
                    skipped.Add($"{key}: tarih anlaşılamadı");
                    continue;
                }
                if (node is not JsonObject dayNode) continue;

                var day = await db.Days.FirstOrDefaultAsync(d => d.FamilyId == familyId && d.Date == date);
                if (day == null)
                {
                    day = new Day { FamilyId = familyId, Date = date };
                    db.Days.Add(day);
                }
                var before = study + training + events;

                foreach (var e in Items(dayNode["studyEntries"]).OfType<JsonObject>())
                {
                    var subject = Text(e["subject"], 100);
                    var minutes = Minutes(e["minutes"]);
                    if (subject.Length == 0 || minutes is null or < 1)
                    {
                        skipped.Add($"{key} ders: {(subject.Length == 0 ? "ders adı yok" : "süre yok")}");
                        continue;
                    }
                    var status = Text(e["status"], 20);
                    day.StudyEntries.Add(Stamp(new StudyEntry
                    {
                        Subject = subject, Topic = Text(e["topic"], 200), Minutes = Math.Min(minutes.Value, 1440),
                        Status = Statuses.Contains(status) ? status : "done", // eski sürümde durumsuz kayıtlar "tamamlandı" sayılırdı
                    }, profileId, now));
                    study++;
                }

                foreach (var t in TrainingItems(dayNode["training"]))
                {
                    var type = Text(t["type"], 50);
                    day.TrainingEntries.Add(Stamp(new TrainingEntry
                    {
                        Type = type.Length > 0 ? type : "Antrenman",
                        Minutes = Math.Clamp(Minutes(t["minutes"]) ?? 0, 0, 1440),
                        Note = Text(t["note"], 500),
                    }, profileId, now));
                    training++;
                }

                foreach (var ev in Items(dayNode["events"]).OfType<JsonObject>())
                {
                    var title = Text(ev["title"], 150);
                    if (title.Length == 0) { skipped.Add($"{key} etkinlik: başlık yok"); continue; }
                    day.Events.Add(Stamp(new Event { Title = title, Time = Text(ev["time"], 20), Note = Text(ev["note"], 500) }, profileId, now));
                    events++;
                }

                if (study + training + events > before) days++;
                else if (day.Id == 0) db.Days.Remove(day); // boş gün oluşturulmaz
            }
        }

        await db.SaveChangesAsync();
        return new Summary(days, study, training, events, subjectsAdded, skipped);
    }

    // Eski sürüm antrenmanı önce tek nesne ({ done, minutes, note }) olarak, sonra liste olarak tutuyordu.
    private static IEnumerable<JsonObject> TrainingItems(JsonNode? raw)
    {
        if (raw is JsonObject o && o["done"] is JsonValue done && done.TryGetValue<bool>(out var isDone))
            return isDone ? [new JsonObject { ["type"] = "Antrenman", ["minutes"] = o["minutes"]?.DeepClone(), ["note"] = o["note"]?.DeepClone() }] : [];
        return Items(raw).OfType<JsonObject>();
    }

    private static T Stamp<T>(T e, int profileId, DateTime now) where T : AuditedEntity
    {
        e.CreatedByMemberId = profileId;
        e.CreatedAt = now;
        e.IsImported = true;
        return e;
    }

    // Firebase dizileri boşluklu olunca { "0": ..., "2": ... } nesnesi olarak dışa aktarır.
    private static IEnumerable<JsonNode> Items(JsonNode? node) => node switch
    {
        JsonArray a => a.OfType<JsonNode>(),
        JsonObject o => o.OrderBy(kv => int.TryParse(kv.Key, out var i) ? i : int.MaxValue).Select(kv => kv.Value).OfType<JsonNode>(),
        _ => [],
    };

    private static string Text(JsonNode? node, int max)
    {
        var s = node is JsonValue v ? v.ToString() : "";
        s = s.Trim();
        return s.Length <= max ? s : s[..max];
    }

    private static int? Minutes(JsonNode? node)
    {
        if (node is not JsonValue v) return null;
        if (v.TryGetValue<int>(out var i)) return i;
        if (v.TryGetValue<double>(out var d)) return (int)Math.Round(d);
        return int.TryParse(v.ToString().Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var p) ? p : null;
    }

    private static int Fail(string message)
    {
        Console.Error.WriteLine("Hata: " + message);
        return 1;
    }
}
