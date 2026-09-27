using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace PlanToBee.API.Migrations
{
    /// <inheritdoc />
    public partial class FamilyAccounts : Migration
    {
        private const string MigrateExistingUsersSql = @"
UPDATE ""AspNetUsers""
SET ""DisplayName"" = LEFT(COALESCE(NULLIF(BTRIM(""UserName""), ''), split_part(""Email"", '@', 1), 'Kullanıcı'), 100)
WHERE ""DisplayName"" = '';

UPDATE ""AspNetUsers"" SET ""EmailConfirmed"" = FALSE;

DO $$
DECLARE
    r record;
    fid integer;
    mid integer;
BEGIN
    FOR r IN
        SELECT u.""Id"", u.""DisplayName"" FROM ""AspNetUsers"" u
        WHERE NOT EXISTS (SELECT 1 FROM ""FamilyMembers"" m WHERE m.""UserId"" = u.""Id"")
        ORDER BY u.""Id""
    LOOP
        INSERT INTO ""Families"" (""Name"", ""CreatedAt"")
        VALUES (LEFT(r.""DisplayName"" || ' Ailesi', 100), now())
        RETURNING ""Id"" INTO fid;

        INSERT INTO ""FamilyMembers"" (""FamilyId"", ""DisplayName"", ""Role"", ""Status"", ""IsAdmin"", ""UserId"", ""CreatedAt"", ""JoinedAt"")
        VALUES (fid, LEFT(r.""DisplayName"", 50), 'Parent', 'Joined', TRUE, r.""Id"", now(), now())
        RETURNING ""Id"" INTO mid;

        UPDATE ""Days"" SET ""MemberId"" = mid WHERE ""UserId"" = r.""Id"";
        UPDATE ""Subjects"" SET ""MemberId"" = mid, ""CreatedByMemberId"" = mid, ""CreatedAt"" = now() WHERE ""UserId"" = r.""Id"";
    END LOOP;
END $$;

UPDATE ""StudyEntries"" e SET ""CreatedByMemberId"" = d.""MemberId"", ""CreatedAt"" = now()
FROM ""Days"" d WHERE e.""DayId"" = d.""Id"" AND e.""CreatedByMemberId"" IS NULL;
UPDATE ""TrainingEntries"" e SET ""CreatedByMemberId"" = d.""MemberId"", ""CreatedAt"" = now()
FROM ""Days"" d WHERE e.""DayId"" = d.""Id"" AND e.""CreatedByMemberId"" IS NULL;
UPDATE ""Events"" e SET ""CreatedByMemberId"" = d.""MemberId"", ""CreatedAt"" = now()
FROM ""Days"" d WHERE e.""DayId"" = d.""Id"" AND e.""CreatedByMemberId"" IS NULL;
";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "TrainingEntries",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "CreatedByMemberId",
                table: "TrainingEntries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsImported",
                table: "TrainingEntries",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "TrainingEntries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UpdatedByMemberId",
                table: "TrainingEntries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Subjects",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "CreatedByMemberId",
                table: "Subjects",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsImported",
                table: "Subjects",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "MemberId",
                table: "Subjects",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Subjects",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UpdatedByMemberId",
                table: "Subjects",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "StudyEntries",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "CreatedByMemberId",
                table: "StudyEntries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsImported",
                table: "StudyEntries",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "StudyEntries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UpdatedByMemberId",
                table: "StudyEntries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Events",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "CreatedByMemberId",
                table: "Events",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsImported",
                table: "Events",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Events",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UpdatedByMemberId",
                table: "Events",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MemberId",
                table: "Days",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "DisplayName",
                table: "AspNetUsers",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "Families",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Families", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FamilyMembers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FamilyId = table.Column<int>(type: "integer", nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IsAdmin = table.Column<bool>(type: "boolean", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    JoinedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LeftAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FamilyMembers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FamilyMembers_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_FamilyMembers_Families_FamilyId",
                        column: x => x.FamilyId,
                        principalTable: "Families",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Invitations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FamilyId = table.Column<int>(type: "integer", nullable: false),
                    MemberId = table.Column<int>(type: "integer", nullable: false),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    NormalizedEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CodeHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CodeSalt = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FailedCodeAttempts = table.Column<int>(type: "integer", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    InvitedByMemberId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastSentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SendCount = table.Column<int>(type: "integer", nullable: false),
                    AcceptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
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

            // ---- Veri geçişi: mevcut her kullanıcı -> tek kişilik aile (Ebeveyn, yönetici) ----
            // Mevcut günler ve ders listesi o kullanıcının üye planına bağlanır; kayıtların
            // "ekleyen"i hesap sahibi olur. Mevcut hesaplar e-postası doğrulanmamış sayılır.
            // NOT EXISTS koşulu sayesinde adım tekrar çalıştırılsa da aynı kullanıcı için ikinci aile açılmaz.
            migrationBuilder.Sql(MigrateExistingUsersSql);

            // Eski kullanıcı bazlı plan sahipliği kaldırılır (veri artık MemberId üzerinde).
            migrationBuilder.DropForeignKey(
                name: "FK_Days_AspNetUsers_UserId",
                table: "Days");

            migrationBuilder.DropForeignKey(
                name: "FK_Subjects_AspNetUsers_UserId",
                table: "Subjects");

            migrationBuilder.DropIndex(
                name: "IX_Subjects_UserId",
                table: "Subjects");

            migrationBuilder.DropIndex(
                name: "IX_Days_UserId_Date",
                table: "Days");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "Subjects");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "Days");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingEntries_CreatedByMemberId",
                table: "TrainingEntries",
                column: "CreatedByMemberId");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingEntries_UpdatedByMemberId",
                table: "TrainingEntries",
                column: "UpdatedByMemberId");

            migrationBuilder.CreateIndex(
                name: "IX_Subjects_CreatedByMemberId",
                table: "Subjects",
                column: "CreatedByMemberId");

            migrationBuilder.CreateIndex(
                name: "IX_Subjects_MemberId",
                table: "Subjects",
                column: "MemberId");

            migrationBuilder.CreateIndex(
                name: "IX_Subjects_UpdatedByMemberId",
                table: "Subjects",
                column: "UpdatedByMemberId");

            migrationBuilder.CreateIndex(
                name: "IX_StudyEntries_CreatedByMemberId",
                table: "StudyEntries",
                column: "CreatedByMemberId");

            migrationBuilder.CreateIndex(
                name: "IX_StudyEntries_UpdatedByMemberId",
                table: "StudyEntries",
                column: "UpdatedByMemberId");

            migrationBuilder.CreateIndex(
                name: "IX_Events_CreatedByMemberId",
                table: "Events",
                column: "CreatedByMemberId");

            migrationBuilder.CreateIndex(
                name: "IX_Events_UpdatedByMemberId",
                table: "Events",
                column: "UpdatedByMemberId");

            migrationBuilder.CreateIndex(
                name: "IX_Days_MemberId_Date",
                table: "Days",
                columns: new[] { "MemberId", "Date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FamilyMembers_FamilyId_Admin",
                table: "FamilyMembers",
                column: "FamilyId",
                unique: true,
                filter: "\"IsAdmin\"");

            migrationBuilder.CreateIndex(
                name: "IX_FamilyMembers_UserId",
                table: "FamilyMembers",
                column: "UserId",
                unique: true,
                filter: "\"UserId\" IS NOT NULL");

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

            migrationBuilder.AddForeignKey(
                name: "FK_Days_FamilyMembers_MemberId",
                table: "Days",
                column: "MemberId",
                principalTable: "FamilyMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Events_FamilyMembers_CreatedByMemberId",
                table: "Events",
                column: "CreatedByMemberId",
                principalTable: "FamilyMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Events_FamilyMembers_UpdatedByMemberId",
                table: "Events",
                column: "UpdatedByMemberId",
                principalTable: "FamilyMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_StudyEntries_FamilyMembers_CreatedByMemberId",
                table: "StudyEntries",
                column: "CreatedByMemberId",
                principalTable: "FamilyMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_StudyEntries_FamilyMembers_UpdatedByMemberId",
                table: "StudyEntries",
                column: "UpdatedByMemberId",
                principalTable: "FamilyMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Subjects_FamilyMembers_CreatedByMemberId",
                table: "Subjects",
                column: "CreatedByMemberId",
                principalTable: "FamilyMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Subjects_FamilyMembers_MemberId",
                table: "Subjects",
                column: "MemberId",
                principalTable: "FamilyMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Subjects_FamilyMembers_UpdatedByMemberId",
                table: "Subjects",
                column: "UpdatedByMemberId",
                principalTable: "FamilyMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_TrainingEntries_FamilyMembers_CreatedByMemberId",
                table: "TrainingEntries",
                column: "CreatedByMemberId",
                principalTable: "FamilyMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_TrainingEntries_FamilyMembers_UpdatedByMemberId",
                table: "TrainingEntries",
                column: "UpdatedByMemberId",
                principalTable: "FamilyMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Geri alma: plan sahipliğini üyenin bağlı kullanıcısına geri yazar. Hesapsız profillerin
            // ve daveti bekleyen üyelerin planları kullanıcıya bağlanamadığı için silinir.
            migrationBuilder.AddColumn<string>(
                name: "UserId",
                table: "Subjects",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UserId",
                table: "Days",
                type: "text",
                nullable: true);

            migrationBuilder.Sql(@"
UPDATE ""Days"" d SET ""UserId"" = m.""UserId"" FROM ""FamilyMembers"" m WHERE d.""MemberId"" = m.""Id"";
UPDATE ""Subjects"" s SET ""UserId"" = m.""UserId"" FROM ""FamilyMembers"" m WHERE s.""MemberId"" = m.""Id"";
DELETE FROM ""Days"" WHERE ""UserId"" IS NULL;
DELETE FROM ""Subjects"" WHERE ""UserId"" IS NULL;
ALTER TABLE ""Days"" ALTER COLUMN ""UserId"" SET NOT NULL;
ALTER TABLE ""Subjects"" ALTER COLUMN ""UserId"" SET NOT NULL;
");

            migrationBuilder.DropForeignKey(
                name: "FK_Days_FamilyMembers_MemberId",
                table: "Days");

            migrationBuilder.DropForeignKey(
                name: "FK_Events_FamilyMembers_CreatedByMemberId",
                table: "Events");

            migrationBuilder.DropForeignKey(
                name: "FK_Events_FamilyMembers_UpdatedByMemberId",
                table: "Events");

            migrationBuilder.DropForeignKey(
                name: "FK_StudyEntries_FamilyMembers_CreatedByMemberId",
                table: "StudyEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_StudyEntries_FamilyMembers_UpdatedByMemberId",
                table: "StudyEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_Subjects_FamilyMembers_CreatedByMemberId",
                table: "Subjects");

            migrationBuilder.DropForeignKey(
                name: "FK_Subjects_FamilyMembers_MemberId",
                table: "Subjects");

            migrationBuilder.DropForeignKey(
                name: "FK_Subjects_FamilyMembers_UpdatedByMemberId",
                table: "Subjects");

            migrationBuilder.DropForeignKey(
                name: "FK_TrainingEntries_FamilyMembers_CreatedByMemberId",
                table: "TrainingEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_TrainingEntries_FamilyMembers_UpdatedByMemberId",
                table: "TrainingEntries");

            migrationBuilder.DropTable(
                name: "Invitations");

            migrationBuilder.DropTable(
                name: "FamilyMembers");

            migrationBuilder.DropTable(
                name: "Families");

            migrationBuilder.DropIndex(
                name: "IX_TrainingEntries_CreatedByMemberId",
                table: "TrainingEntries");

            migrationBuilder.DropIndex(
                name: "IX_TrainingEntries_UpdatedByMemberId",
                table: "TrainingEntries");

            migrationBuilder.DropIndex(
                name: "IX_Subjects_CreatedByMemberId",
                table: "Subjects");

            migrationBuilder.DropIndex(
                name: "IX_Subjects_MemberId",
                table: "Subjects");

            migrationBuilder.DropIndex(
                name: "IX_Subjects_UpdatedByMemberId",
                table: "Subjects");

            migrationBuilder.DropIndex(
                name: "IX_StudyEntries_CreatedByMemberId",
                table: "StudyEntries");

            migrationBuilder.DropIndex(
                name: "IX_StudyEntries_UpdatedByMemberId",
                table: "StudyEntries");

            migrationBuilder.DropIndex(
                name: "IX_Events_CreatedByMemberId",
                table: "Events");

            migrationBuilder.DropIndex(
                name: "IX_Events_UpdatedByMemberId",
                table: "Events");

            migrationBuilder.DropIndex(
                name: "IX_Days_MemberId_Date",
                table: "Days");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "TrainingEntries");

            migrationBuilder.DropColumn(
                name: "CreatedByMemberId",
                table: "TrainingEntries");

            migrationBuilder.DropColumn(
                name: "IsImported",
                table: "TrainingEntries");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "TrainingEntries");

            migrationBuilder.DropColumn(
                name: "UpdatedByMemberId",
                table: "TrainingEntries");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Subjects");

            migrationBuilder.DropColumn(
                name: "CreatedByMemberId",
                table: "Subjects");

            migrationBuilder.DropColumn(
                name: "IsImported",
                table: "Subjects");

            migrationBuilder.DropColumn(
                name: "MemberId",
                table: "Subjects");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Subjects");

            migrationBuilder.DropColumn(
                name: "UpdatedByMemberId",
                table: "Subjects");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "StudyEntries");

            migrationBuilder.DropColumn(
                name: "CreatedByMemberId",
                table: "StudyEntries");

            migrationBuilder.DropColumn(
                name: "IsImported",
                table: "StudyEntries");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "StudyEntries");

            migrationBuilder.DropColumn(
                name: "UpdatedByMemberId",
                table: "StudyEntries");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "CreatedByMemberId",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "IsImported",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "UpdatedByMemberId",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "MemberId",
                table: "Days");

            migrationBuilder.DropColumn(
                name: "DisplayName",
                table: "AspNetUsers");

            migrationBuilder.CreateIndex(
                name: "IX_Subjects_UserId",
                table: "Subjects",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Days_UserId_Date",
                table: "Days",
                columns: new[] { "UserId", "Date" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Days_AspNetUsers_UserId",
                table: "Days",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Subjects_AspNetUsers_UserId",
                table: "Subjects",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
