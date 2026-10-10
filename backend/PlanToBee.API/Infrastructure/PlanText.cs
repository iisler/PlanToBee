using System.Globalization;

namespace PlanToBee.API.Infrastructure;

// Plan uç noktalarında ortak kullanılan metin ve tarih kuralları.
public static class PlanText
{
    // Türkçe kurallarıyla büyük/küçük harf duyarsız karşılaştırma (ör. "İngilizce" = "ingilizce").
    public static readonly StringComparer TurkishIgnoreCase =
        StringComparer.Create(new CultureInfo("tr-TR"), ignoreCase: true);

    public const string DateFormat = "yyyy-MM-dd";

    // Rota tarihleri yalnızca "yyyy-MM-dd" biçiminde kabul edilir. Sunucunun kültür ayarından
    // bağımsızdır (ör. "1/2/2026" gibi belirsiz biçimler reddedilir). Aralık dışı yıllar da reddedilir;
    // böylece hafta hesabındaki AddDays taşıp 500 hatası üretemez.
    public static bool TryParseDate(string? value, out DateOnly date)
    {
        if (DateOnly.TryParseExact(value, DateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out date)
            && date.Year is >= 1900 and <= 2999)
            return true;
        date = default;
        return false;
    }

    public static string Format(DateOnly date) => date.ToString(DateFormat, CultureInfo.InvariantCulture);

    // Etkinlik/antrenman saati: SS:dd (00:00-23:59). Saat seçicinin ürettiği biçim.
    public static bool IsTime(string? value) =>
        value is { Length: 5 } && value[2] == ':' &&
        int.TryParse(value.AsSpan(0, 2), NumberStyles.None, CultureInfo.InvariantCulture, out var h) && h <= 23 &&
        int.TryParse(value.AsSpan(3, 2), NumberStyles.None, CultureInfo.InvariantCulture, out var m) && m <= 59;

    // Okumada gösterilen bitiş. Geri dönüşte eski kod saati silip ya da bitişe eşitleyip kaydedebilir (bitiş sütununu
    // bilmez); ileri geçildiğinde anlamsız kalan bitiş istemciye gönderilmez.
    public static string? EndTime(string time, string? endTime) =>
        endTime != null && IsTime(time) && IsTime(endTime) && endTime != time ? endTime : null;

    // Bitişi girilmemiş eski spor kayıtlarında bitiş, başlangıç + süreden (Minutes) türetilir. Yalnızca gösterim
    // içindir, veritabanına yazılmaz. Başlangıç SS:dd değilse ya da süre tam gün katıysa (bitiş = başlangıç) türetilmez.
    public static string? DerivedEndTime(string time, string? endTime, int? minutes)
    {
        if (endTime != null || minutes is not > 0 || minutes % 1440 == 0 || !IsTime(time)) return null;
        var start = int.Parse(time.AsSpan(0, 2), CultureInfo.InvariantCulture) * 60 + int.Parse(time.AsSpan(3, 2), CultureInfo.InvariantCulture);
        var end = (start + minutes.Value) % 1440;
        return $"{end / 60:00}:{end % 60:00}";
    }
}
