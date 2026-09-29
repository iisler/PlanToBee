using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using PlanToBee.API.Models;

namespace PlanToBee.API.Data;

// IDataProtectionKeyContext: Data Protection anahtarları (şifre sıfırlama / e-posta doğrulama
// belirteçlerini imzalar) veritabanında saklanır. Böylece Render'da konteyner yeniden başlasa ya da
// uykudan uyansa bile önceden gönderilmiş linkler geçerli kalır.
public class AppDbContext : IdentityDbContext<User>, IDataProtectionKeyContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Family> Families => Set<Family>();
    public DbSet<FamilyMember> FamilyMembers => Set<FamilyMember>();
    public DbSet<Invitation> Invitations => Set<Invitation>();
    public DbSet<Subject> Subjects => Set<Subject>();
    public DbSet<Day> Days => Set<Day>();
    public DbSet<StudyEntry> StudyEntries => Set<StudyEntry>();
    public DbSet<TrainingEntry> TrainingEntries => Set<TrainingEntry>();
    public DbSet<Event> Events => Set<Event>();
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

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
            b.HasOne(m => m.User).WithMany().HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.SetNull);
            // Bir kullanıcı aynı anda yalnızca bir aileye üye olabilir.
            b.HasIndex(m => m.UserId).IsUnique().HasFilter("\"UserId\" IS NOT NULL");
            // Her ailenin en fazla bir yöneticisi olur.
            b.HasIndex(m => m.FamilyId).IsUnique().HasFilter("\"IsAdmin\"").HasDatabaseName("IX_FamilyMembers_FamilyId_Admin");
        });

        builder.Entity<Invitation>(b =>
        {
            b.Property(i => i.Email).HasMaxLength(256);
            b.Property(i => i.NormalizedEmail).HasMaxLength(256);
            b.Property(i => i.TokenHash).HasMaxLength(64);
            b.Property(i => i.CodeHash).HasMaxLength(64);
            b.Property(i => i.CodeSalt).HasMaxLength(64);
            b.Property(i => i.Status).HasConversion<string>().HasMaxLength(20);
            b.Property(i => i.Version).IsRowVersion();
            b.HasOne(i => i.Family).WithMany().HasForeignKey(i => i.FamilyId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(i => i.Member).WithMany().HasForeignKey(i => i.MemberId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(i => i.InvitedBy).WithMany().HasForeignKey(i => i.InvitedByMemberId).OnDelete(DeleteBehavior.SetNull);
            b.HasIndex(i => i.TokenHash).IsUnique();
            b.HasIndex(i => new { i.NormalizedEmail, i.Status });
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
        ConfigureAudit<Event>(builder);
        ConfigureAudit<Subject>(builder);
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
