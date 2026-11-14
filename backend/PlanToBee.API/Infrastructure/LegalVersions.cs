using PlanToBee.API.DTOs;
using PlanToBee.API.Models;

namespace PlanToBee.API.Infrastructure;

// Aydınlatma Metni ve Kullanım Koşulları'nın güncel sürümleri: tek kaynak burasıdır (docs/tasks/18-yasal-metin-surumu.md).
// Metin değişince sürüm burada artırılır; aynı PR'da frontend/public/legal/*.html ve docs/legal/*.md içindeki
// "Sürüm N · Yürürlük tarihi" satırı da güncellenir (e2e kontrol eder; önyüz kabul edilen sürümü bu satırdan okur).
// Kabul edilen sürüm güncelden küçükse hesap sahibinden girişten sonra yeniden onay istenir.
public static class LegalVersions
{
    public const int Kvkk = 3;
    public const int Terms = 3;

    public static LegalStatusDto StatusOf(User user) => new(
        Kvkk, Terms, user.KvkkVersion, user.TermsVersion,
        (user.KvkkVersion ?? 0) < Kvkk, (user.TermsVersion ?? 0) < Terms);
}
