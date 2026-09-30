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
}
