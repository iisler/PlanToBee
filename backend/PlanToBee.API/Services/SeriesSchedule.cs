namespace PlanToBee.API.Services;

// Tekrar kuralının tarih hesabı. Günler istemciye ISO numarasıyla gider (1 = Pazartesi ... 7 = Pazar),
// veritabanında bit maskesi olarak durur (Pazartesi = 1 << 0 ... Pazar = 1 << 6).
public static class SeriesSchedule
{
    public const int AllDays = 0b111_1111;
    private static readonly string[] Short = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

    public static int IsoDay(DateOnly d) => (int)d.DayOfWeek == 0 ? 7 : (int)d.DayOfWeek;
    public static int Bit(DateOnly d) => 1 << (IsoDay(d) - 1);

    // null: geçersiz gün numarası (1-7 dışı). Tekrarlanan numaralar tek sayılır.
    public static int? Mask(IEnumerable<int> isoDays)
    {
        var mask = 0;
        foreach (var d in isoDays)
        {
            if (d is < 1 or > 7) return null;
            mask |= 1 << (d - 1);
        }
        return mask;
    }

    public static List<int> IsoDays(int mask) =>
        Enumerable.Range(1, 7).Where(d => (mask & (1 << (d - 1))) != 0).ToList();

    public static bool IsOccurrence(int mask, DateOnly start, DateOnly until, DateOnly date) =>
        date >= start && date <= until && (mask & Bit(date)) != 0;

    // [from, to] aralığına düşen tekrar günleri (istisnalar hariç). Aralık en fazla birkaç gün olduğundan gün gün
    // gezmek yeterli.
    public static IEnumerable<DateOnly> Occurrences(int mask, DateOnly start, DateOnly until, DateOnly from, DateOnly to,
        ICollection<DateOnly> skipped)
    {
        var first = from > start ? from : start;
        var last = to < until ? to : until;
        for (var d = first; d <= last; d = d.AddDays(1))
            if ((mask & Bit(d)) != 0 && !skipped.Contains(d)) yield return d;
    }

    // Kuralın en az bir günü var mı (ör. tek gün aralığında yalnızca cumartesi seçilmişse yok).
    public static bool HasAny(int mask, DateOnly start, DateOnly until)
    {
        var last = until < start.AddDays(6) ? until : start.AddDays(6);
        for (var d = start; d <= last; d = d.AddDays(1))
            if ((mask & Bit(d)) != 0) return true;
        return false;
    }

    // Bildirim metni için gün özeti: "Her gün", "Pzt–Cum", "Pzt, Çar, Cum", "Pzt–Çar, Cmt".
    // Ardışık üç ve daha fazla gün aralık olarak yazılır.
    public static string DaysText(int mask)
    {
        if ((mask & AllDays) == AllDays) return "Her gün";
        var parts = new List<string>();
        var i = 0;
        while (i < 7)
        {
            if ((mask & (1 << i)) == 0) { i++; continue; }
            var j = i;
            while (j + 1 < 7 && (mask & (1 << (j + 1))) != 0) j++;
            if (j - i >= 2) parts.Add($"{Short[i]}–{Short[j]}");
            else parts.AddRange(Enumerable.Range(i, j - i + 1).Select(k => Short[k]));
            i = j + 1;
        }
        return string.Join(", ", parts);
    }
}
