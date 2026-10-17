using PlanToBee.API.Models;

namespace PlanToBee.API.Services;

// Türkiye resmî tatilleri, MEB okul tatilleri ve özel günler (sabit tablo; dış servis kullanılmaz).
// Sabit tarihli resmî tatiller her yıl hesaplanır. Dinî bayramlar ve okul takvimi her yıl değişir: yeni yılın
// tarihleri (Diyanet takvimi, MEB çalışma takvimi) aşağıdaki listelere elle eklenir.
// Kind: "official" tam gün resmî tatil · "half" arife (13:00'ten sonra tatil) · "school" okul tatili · "special" özel gün.
// Tam gün resmî tatilde ve okul tatilinde Okul türündeki tekrarlar gösterilmez (ClosesSchool).
public static class Holidays
{
    public record Holiday(string Name, string Kind);

    private static readonly (int M, int D, string Name)[] FixedOfficial =
    [
        (1, 1, "Yılbaşı"),
        (4, 23, "Ulusal Egemenlik ve Çocuk Bayramı"),
        (5, 1, "Emek ve Dayanışma Günü"),
        (5, 19, "Atatürk'ü Anma, Gençlik ve Spor Bayramı"),
        (7, 15, "Demokrasi ve Millî Birlik Günü"),
        (8, 30, "Zafer Bayramı"),
        (10, 29, "Cumhuriyet Bayramı"),
    ];

    private static readonly (int M, int D, string Name)[] FixedSpecial =
    [
        (11, 10, "Atatürk'ü Anma Günü"),
        (11, 24, "Öğretmenler Günü"),
    ];

    // Dinî bayramlar (Diyanet): arife günü + bayram günleri.
    private static readonly (string Arife, int Days, string Name)[] Religious =
    [
        ("2026-03-19", 3, "Ramazan Bayramı"),
        ("2026-05-26", 4, "Kurban Bayramı"),
        ("2027-03-08", 3, "Ramazan Bayramı"),
        ("2027-05-15", 4, "Kurban Bayramı"),
    ];

    // MEB okul tatilleri (2026-2027 çalışma takvimi), başlangıç ve bitiş dahil.
    private static readonly (string From, string To, string Name)[] School =
    [
        ("2026-11-16", "2026-11-20", "Okullar ara tatilde"),
        ("2027-01-25", "2027-02-05", "Yarıyıl tatili"),
        ("2027-03-08", "2027-03-12", "Okullar ara tatilde"),
        ("2027-06-26", "2027-09-12", "Yaz tatili"),
    ];

    // Okulun son günü gibi tatil olmayan okul günleri (yalnızca etiket).
    private static readonly (string Date, string Name)[] SchoolSpecial =
    [
        ("2027-01-22", "Karne günü"),
        ("2027-06-25", "Karne günü · Okulun son günü"),
    ];

    private static readonly Dictionary<DateOnly, List<Holiday>> Table = Build();

    private static Dictionary<DateOnly, List<Holiday>> Build()
    {
        var t = new Dictionary<DateOnly, List<Holiday>>();
        void Add(DateOnly d, string name, string kind)
        {
            if (!t.TryGetValue(d, out var list)) t[d] = list = [];
            list.Add(new Holiday(name, kind));
        }
        for (var y = 2026; y <= 2030; y++)
        {
            foreach (var (m, d, name) in FixedOfficial) Add(new DateOnly(y, m, d), name, "official");
            foreach (var (m, d, name) in FixedSpecial) Add(new DateOnly(y, m, d), name, "special");
            Add(new DateOnly(y, 10, 28), "Cumhuriyet Bayramı arifesi", "half");
            Add(new DateOnly(y, 12, 31), "Yılbaşı gecesi", "special");
            Add(NthSunday(y, 5, 2), "Anneler Günü", "special");
            Add(NthSunday(y, 6, 3), "Babalar Günü", "special");
        }
        foreach (var (arife, days, name) in Religious)
        {
            var a = DateOnly.Parse(arife);
            Add(a, $"{name} arifesi", "half");
            for (var i = 1; i <= days; i++) Add(a.AddDays(i), $"{name} {i}. gün", "official");
        }
        foreach (var (from, to, name) in School)
            for (var d = DateOnly.Parse(from); d <= DateOnly.Parse(to); d = d.AddDays(1))
                if (SeriesSchedule.IsoDay(d) <= 5) Add(d, name, "school"); // hafta sonu zaten okul yok
        foreach (var (date, name) in SchoolSpecial) Add(DateOnly.Parse(date), name, "special");
        // Resmî tatil önce, sonra arife, okul tatili, özel gün
        string[] order = ["official", "half", "school", "special"];
        foreach (var list in t.Values) list.Sort((a, b) => Array.IndexOf(order, a.Kind) - Array.IndexOf(order, b.Kind));
        return t;
    }

    private static DateOnly NthSunday(int year, int month, int n)
    {
        var d = new DateOnly(year, month, 1);
        while (d.DayOfWeek != DayOfWeek.Sunday) d = d.AddDays(1);
        return d.AddDays(7 * (n - 1));
    }

    public static IReadOnlyList<Holiday> On(DateOnly date) =>
        Table.TryGetValue(date, out var list) ? list : [];

    // Okul tekrarı bu gün gösterilmez: tam gün resmî tatil ya da okul tatili.
    public static bool ClosesSchool(DateOnly date) =>
        Table.TryGetValue(date, out var list) && list.Any(h => h.Kind is "official" or "school");

    // Tekrar bu gün görünür mü (Okul türü tatilde görünmez).
    public static bool Shows(EventKind kind, DateOnly date) => kind != EventKind.School || !ClosesSchool(date);
}
