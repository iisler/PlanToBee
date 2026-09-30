using Microsoft.EntityFrameworkCore;
using PlanToBee.API.Data;

namespace PlanToBee.API.Services;

// Aile bazlı PostgreSQL danışma kilitleri (transaction sonunda kendiliğinden bırakılır).
// Ders listesinde (FamilyId, Name) için veritabanı düzeyinde benzersizlik yok (Türkçe büyük/küçük harf
// kuralı SQL'de birebir uygulanamıyor); eşzamanlı iki istek aynı dersi ya da varsayılan listeyi iki kez
// eklemesin diye ders listesine yazan işlemler bu kilidi alır. Çağıran taraf bir transaction açmış olmalıdır.
public static class PlanLocks
{
    private const int SubjectsNamespace = 71_001;

    public static Task LockSubjectsAsync(AppDbContext db, int familyId) =>
        db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock({SubjectsNamespace}, {familyId})");
}
