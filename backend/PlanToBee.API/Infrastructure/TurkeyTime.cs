namespace PlanToBee.API.Infrastructure;

// E-postalarda gösterilen saatler Türkiye saatiyle yazılır. Saat dilimi verisi (tzdata) sistemde yoksa
// Türkiye 2016'dan beri yaz saati uygulamadığı için sabit UTC+3 kullanılır.
public static class TurkeyTime
{
    private static readonly TimeZoneInfo Zone = Find();

    private static TimeZoneInfo Find()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul"); }
        catch (Exception e) when (e is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            return TimeZoneInfo.CreateCustomTimeZone("TRT", TimeSpan.FromHours(3), "Türkiye", "Türkiye");
        }
    }

    public static DateTime FromUtc(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Zone);

    // Örnek: "07.10.2026 01:15 (Türkiye saati)"
    public static string Format(DateTime utc) => $"{FromUtc(utc):dd.MM.yyyy HH:mm} (Türkiye saati)";
}
