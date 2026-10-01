using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace PlanToBee.API.Migrations
{
    // Netflix tarzı profillere geçiş: aile tek hesapla giriş yapar, üyeler profil olur.
    // - Davetler kaldırılır (Invitations tablosu silinir).
    // - Üye durumları sadeleşir: NoAccount / Invited / Joined -> Active, Left aynen kalır.
    // - Hesap sahibi (IsAdmin) dışındaki profillerin kişisel hesap bağı kaldırılır; bu kişiler artık aile
    //   hesabıyla girip profillerini seçer. Kişisel hesapları silinmez, ailesiz hesap olarak kalır.
    // - Profil PIN'i ve yenileme belirtecindeki seçili profil (MemberId) alanları eklenir. Mevcut ebeveyn
    //   profillerinin PIN'i yoktur; ilk seçimde hesap şifresiyle PIN belirlenir (ProfilesController.Select).
    /// <inheritdoc />
    public partial class ProfileLogin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Invitations");

            migrationBuilder.DropColumn(
                name: "JoinedAt",
                table: "FamilyMembers");

            migrationBuilder.AddColumn<DateTime>(
                name: "PinLockedUntil",
                table: "FamilyMembers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE "FamilyMembers" SET "Status" = 'Active' WHERE "Status" IN ('NoAccount', 'Invited', 'Joined');
                UPDATE "FamilyMembers" SET "UserId" = NULL WHERE NOT "IsAdmin" AND "UserId" IS NOT NULL;
                """);

            migrationBuilder.AddColumn<int>(
                name: "MemberId",
                table: "RefreshTokens",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FailedPinAttempts",
                table: "FamilyMembers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "PinHash",
                table: "FamilyMembers",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_MemberId",
                table: "RefreshTokens",
                column: "MemberId");

            migrationBuilder.AddForeignKey(
                name: "FK_RefreshTokens_FamilyMembers_MemberId",
                table: "RefreshTokens",
                column: "MemberId",
                principalTable: "FamilyMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RefreshTokens_FamilyMembers_MemberId",
                table: "RefreshTokens");

            migrationBuilder.DropIndex(
                name: "IX_RefreshTokens_MemberId",
                table: "RefreshTokens");

            migrationBuilder.DropColumn(
                name: "MemberId",
                table: "RefreshTokens");

            migrationBuilder.DropColumn(
                name: "FailedPinAttempts",
                table: "FamilyMembers");

            migrationBuilder.DropColumn(
                name: "PinHash",
                table: "FamilyMembers");

            migrationBuilder.DropColumn(
                name: "PinLockedUntil",
                table: "FamilyMembers");

            migrationBuilder.AddColumn<DateTime>(
                name: "JoinedAt",
                table: "FamilyMembers",
                type: "timestamp with time zone",
                nullable: true);

            // Geri alma: aktif profiller hesapsız profil olur (hesap sahibi Joined). Kaldırılan hesap bağları ve
            // davetler geri gelmez.
            migrationBuilder.Sql("""
                UPDATE "FamilyMembers" SET "Status" = CASE WHEN "UserId" IS NOT NULL THEN 'Joined' ELSE 'NoAccount' END WHERE "Status" = 'Active';
                """);

            migrationBuilder.CreateTable(
                name: "Invitations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FamilyId = table.Column<int>(type: "integer", nullable: false),
                    InvitedByMemberId = table.Column<int>(type: "integer", nullable: true),
                    MemberId = table.Column<int>(type: "integer", nullable: false),
                    AcceptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CodeHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CodeSalt = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Email = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FailedCodeAttempts = table.Column<int>(type: "integer", nullable: false),
                    LastSentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NormalizedEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    SendCount = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Invitations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Invitations_Families_FamilyId",
                        column: x => x.FamilyId,
                        principalTable: "Families",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Invitations_FamilyMembers_InvitedByMemberId",
                        column: x => x.InvitedByMemberId,
                        principalTable: "FamilyMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Invitations_FamilyMembers_MemberId",
                        column: x => x.MemberId,
                        principalTable: "FamilyMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Invitations_FamilyId",
                table: "Invitations",
                column: "FamilyId");

            migrationBuilder.CreateIndex(
                name: "IX_Invitations_InvitedByMemberId",
                table: "Invitations",
                column: "InvitedByMemberId");

            migrationBuilder.CreateIndex(
                name: "IX_Invitations_MemberId",
                table: "Invitations",
                column: "MemberId");

            migrationBuilder.CreateIndex(
                name: "IX_Invitations_NormalizedEmail_Status",
                table: "Invitations",
                columns: new[] { "NormalizedEmail", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Invitations_TokenHash",
                table: "Invitations",
                column: "TokenHash",
                unique: true);
        }
    }
}
