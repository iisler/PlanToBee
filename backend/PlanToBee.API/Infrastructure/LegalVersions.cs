using PlanToBee.API.DTOs;
using PlanToBee.API.Models;

namespace PlanToBee.API.Infrastructure;

// Aydınlatma Metni ve Kullanım Koşulları'nın güncel sürümleri: tek kaynak burasıdır (docs/tasks/18-yasal-metin-surumu.md).
// Metin değişince sürüm burada artırılır; aynı PR'da frontend/public/legal/*.html içindeki
// <meta name="legal-version"> ve görünen "Sürüm N" satırı ile docs/legal/*.md de güncellenir (e2e kontrol eder).
// Kabul edilen sürüm güncelden küçükse hesap sahibinden girişten sonra yeniden onay istenir.
public static class LegalVersions
{
    public const int Kvkk = 2;
    public const int Terms = 2;

    public static LegalStatusDto StatusOf(User user) => new(
        Kvkk, Terms, user.KvkkVersion, user.TermsVersion,
        (user.KvkkVersion ?? 0) < Kvkk, (user.TermsVersion ?? 0) < Terms);
}
