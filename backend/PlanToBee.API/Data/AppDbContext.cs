using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using PlanToBee.API.Infrastructure;
using PlanToBee.API.Models;

namespace PlanToBee.API.Data;

// IDataProtectionKeyContext: Data Protection anahtarları (şifre sıfırlama / e-posta doğrulama
// belirteçlerini imzalar) veritabanında saklanır. Böylece Render'da konteyner yeniden başlasa ya da
// uykudan uyansa bile önceden gönderilmiş linkler geçerli kalır.
//
// E-posta adresleri ve kullanıcı adları şifreli, aranan normalize alanları anahtarlı özetle saklanır
// (Infrastructure/PersonalDataProtector.cs). Uygulama kodu bu alanlarla açık metin olarak çalışır.
public class AppDbContext(DbContextOptions<AppDbContext> options, PersonalDataProtector personalData)
    : IdentityDbContext<User>(options), IDataProtectionKeyContext
{

    public DbSet<Family> Families => Set<Family>();
    public DbSet<FamilyMember> FamilyMembers => Set<FamilyMember>();
    public DbSet<Subject> Subjects => Set<Subject>();
    public DbSet<Day> Days => Set<Day>();
    public DbSet<StudyEntry> StudyEntries => Set<StudyEntry>();
    // ESKİ: yalnızca yedek tablo olarak modelde (bkz. Models/TrainingEntry.cs)
    public DbSet<TrainingEntry> TrainingEntries => Set<TrainingEntry>();
    public DbSet<Event> Events => Set<Event>();
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PushSubscription> PushSubscriptions => Set<PushSubscription>();
    public DbSet<NotificationPreference> NotificationPreferences => Set<NotificationPreference>();
    public DbSet<PendingNotification> PendingNotifications => Set<PendingNotification>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Identity tabloları varsayılan "AspNet" öneki yerine diğer tablolarla uyumlu adlarla tutulur.
        builder.Entity<User>().ToTable("Users");
        builder.Entity<IdentityRole>().ToTable("Roles");
        builder.Entity<IdentityUserRole<string>>().ToTable("UserRoles");
        builder.Entity<IdentityUserClaim<string>>().ToTable("UserClaims");
        builder.Entity<IdentityUserLogin<string>>().ToTable("UserLogins");
        builder.Entity<IdentityUserToken<string>>().ToTable("UserTokens");
        builder.Entity<IdentityRoleClaim<string>>().ToTable("RoleClaims");

        builder.Entity<User>(b =>
        {
            b.Property(u => u.DisplayName).HasMaxLength(100);
            // Şifreli değer açık metinden uzundur (256 karakterlik adres yaklaşık 380 karakter olur).
            b.Property(u => u.Email).HasMaxLength(512).HasConversion(personalData.EncryptedConverter());
            b.Property(u => u.UserName).HasMaxLength(512).HasConversion(personalData.EncryptedConverter());
            b.Property(u => u.NormalizedEmail).HasConversion(personalData.IndexConverter());
            b.Property(u => u.NormalizedUserName).HasConversion(personalData.IndexConverter());
        });

        builder.Entity<RefreshToken>(b =>
        {
            b.Property(t => t.TokenHash).HasMaxLength(64);
            b.Property(t => t.ReplacedByHash).HasMaxLength(64);
            b.Property(t => t.SecurityStamp).HasMaxLength(256);
            b.HasOne(t => t.User).WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne<FamilyMember>().WithMany().HasForeignKey(t => t.MemberId).OnDelete(DeleteBehavior.SetNull);
            b.HasIndex(t => t.TokenHash).IsUnique();
            b.HasIndex(t => t.UserId);
        });

        builder.Entity<Family>(b =>
        {
            b.Property(f => f.Name).HasMaxLength(100);
            b.HasMany(f => f.Members).WithOne(m => m.Family!).HasForeignKey(m => m.FamilyId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<FamilyMember>(b =>
        {
            b.Property(m => m.DisplayName).HasMaxLength(50);
            b.Property(m => m.Role).HasConversion<string>().HasMaxLength(20);
            b.Property(m => m.Status).HasConversion<string>().HasMaxLength(20);
            b.Property(m => m.PinHash).HasMaxLength(200);
            b.HasOne(m => m.User).WithMany().HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.SetNull);
            // Bir hesap yalnızca bir ailenin sahibi olabilir.
            b.HasIndex(m => m.UserId).IsUnique().HasFilter("\"UserId\" IS NOT NULL");
            // Her ailenin tek bir hesap sahibi profili olur.
            b.HasIndex(m => m.FamilyId).IsUnique().HasFilter("\"IsAdmin\"").HasDatabaseName("IX_FamilyMembers_FamilyId_Admin");
            // Ailenin profillerini listeleyen sorgular (profil seçimi, Ailem ekranı) ve
            // Families silinirken FK taraması için. Yukarıdaki kısmi (IsAdmin) indeks bu sorgularda kullanılamaz.
            b.HasIndex(m => new { m.FamilyId, m.Status });
        });

        builder.Entity<Day>(b =>
        {
            b.HasOne(d => d.Family).WithMany().HasForeignKey(d => d.FamilyId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(d => new { d.FamilyId, d.Date }).IsUnique();
        });

        builder.Entity<Subject>(b =>
        {
            b.HasOne(s => s.Family).WithMany().HasForeignKey(s => s.FamilyId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(s => s.FamilyId);
        });

        ConfigureAudit<StudyEntry>(builder);
        ConfigureAudit<TrainingEntry>(builder);
        builder.Entity<TrainingEntry>().HasOne(t => t.Day).WithMany().HasForeignKey(t => t.DayId).OnDelete(DeleteBehavior.Cascade);
        ConfigureAudit<Event>(builder);
        builder.Entity<Event>(b =>
        {
            b.Property(e => e.Kind).HasConversion<string>().HasMaxLength(20);
            b.Property(e => e.TrainingType).HasMaxLength(50);
        });
        ConfigureAudit<Subject>(builder);

        // Bildirimler (Web Push). Abonelik adresi ve anahtarları şifreli; aramak için anahtarlı özet.
        builder.Entity<PushSubscription>(b =>
        {
            b.Property(p => p.Endpoint).HasMaxLength(2048).HasConversion(personalData.EncryptedTextConverter());
            b.Property(p => p.P256dh).HasMaxLength(256).HasConversion(personalData.EncryptedTextConverter());
            b.Property(p => p.Auth).HasMaxLength(128).HasConversion(personalData.EncryptedTextConverter());
            b.Property(p => p.EndpointIndex).HasMaxLength(64).HasConversion(personalData.IndexTextConverter());
            b.Property(p => p.DeviceLabel).HasMaxLength(60);
            b.HasIndex(p => p.EndpointIndex).IsUnique();
            b.HasIndex(p => p.FamilyId);
            b.HasIndex(p => p.MemberId);
            b.HasOne<Family>().WithMany().HasForeignKey(p => p.FamilyId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(p => p.Member).WithMany().HasForeignKey(p => p.MemberId).OnDelete(DeleteBehavior.Cascade);
        });
        builder.Entity<NotificationPreference>(b =>
        {
            b.HasKey(p => p.MemberId);
            b.HasOne(p => p.Member).WithMany().HasForeignKey(p => p.MemberId).OnDelete(DeleteBehavior.Cascade);
        });
        builder.Entity<PendingNotification>(b =>
        {
            b.Property(p => p.Category).HasConversion<string>().HasMaxLength(20);
            b.Property(p => p.ActorName).HasMaxLength(50);
            b.Property(p => p.Title).HasMaxLength(120);
            b.Property(p => p.Body).HasMaxLength(300);
            b.HasIndex(p => p.RecipientMemberId);
            b.HasOne<Family>().WithMany().HasForeignKey(p => p.FamilyId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne<FamilyMember>().WithMany().HasForeignKey(p => p.RecipientMemberId).OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureAudit<T>(ModelBuilder builder) where T : AuditedEntity
    {
        builder.Entity<T>(b =>
        {
            b.HasOne(e => e.CreatedBy).WithMany().HasForeignKey(e => e.CreatedByMemberId).OnDelete(DeleteBehavior.SetNull);
            b.HasOne(e => e.UpdatedBy).WithMany().HasForeignKey(e => e.UpdatedByMemberId).OnDelete(DeleteBehavior.SetNull);
        });
    }
}
