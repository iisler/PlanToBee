using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PlanToBee.API.Migrations
{
    // Kişisel planlardan ailenin ortak planına geçiş.
    // Days ve Subjects artık üyeye (MemberId) değil aileye (FamilyId) bağlıdır. Mevcut veride:
    // - her gün ve ders, sahibi olan üyenin ailesine aktarılır;
    // - aynı ailede aynı tarihli birden fazla gün varsa kayıtlar en eski güne toplanır, diğer günler silinir;
    // - aynı ailede aynı adlı (büyük/küçük harf duyarsız) dersler teke indirilir.
    // Kayıtların ekleyen/düzenleyen izleri (CreatedByMemberId, UpdatedByMemberId) değişmez.
    /// <inheritdoc />
    public partial class SharedFamilyPlan : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(name: "FK_Days_FamilyMembers_MemberId", table: "Days");
            migrationBuilder.DropForeignKey(name: "FK_Subjects_FamilyMembers_MemberId", table: "Subjects");
            // Benzersiz (MemberId, Date) indeksi, günler birleştirilene kadar kaldırılır
            migrationBuilder.DropIndex(name: "IX_Days_MemberId_Date", table: "Days");
            migrationBuilder.DropIndex(name: "IX_Subjects_MemberId", table: "Subjects");

            migrationBuilder.RenameColumn(name: "MemberId", table: "Days", newName: "FamilyId");
            migrationBuilder.RenameColumn(name: "MemberId", table: "Subjects", newName: "FamilyId");

            // Sütunda şu an üye kimliği var: üyenin ailesine çevir
            migrationBuilder.Sql("""
                UPDATE "Days" d SET "FamilyId" = m."FamilyId"
                FROM "FamilyMembers" m WHERE m."Id" = d."FamilyId";
                UPDATE "Subjects" s SET "FamilyId" = m."FamilyId"
                FROM "FamilyMembers" m WHERE m."Id" = s."FamilyId";
                """);

            // Aynı aile + tarih için tek gün kalır; kayıtlar o güne taşınır
            foreach (var table in new[] { "StudyEntries", "TrainingEntries", "Events" })
            {
                migrationBuilder.Sql($"""
                    WITH keep AS (SELECT "FamilyId", "Date", MIN("Id") AS "KeepId" FROM "Days" GROUP BY "FamilyId", "Date")
                    UPDATE "{table}" e SET "DayId" = k."KeepId"
                    FROM "Days" d JOIN keep k ON k."FamilyId" = d."FamilyId" AND k."Date" = d."Date"
                    WHERE e."DayId" = d."Id" AND d."Id" <> k."KeepId";
                    """);
            }
            migrationBuilder.Sql("""
                DELETE FROM "Days" d USING "Days" o
                WHERE o."FamilyId" = d."FamilyId" AND o."Date" = d."Date" AND o."Id" < d."Id";
                DELETE FROM "Subjects" s USING "Subjects" o
                WHERE o."FamilyId" = s."FamilyId" AND lower(btrim(o."Name")) = lower(btrim(s."Name")) AND o."Id" < s."Id";
                """);

            migrationBuilder.CreateIndex(name: "IX_Days_FamilyId_Date", table: "Days", columns: new[] { "FamilyId", "Date" }, unique: true);
            migrationBuilder.CreateIndex(name: "IX_Subjects_FamilyId", table: "Subjects", column: "FamilyId");

            migrationBuilder.AddForeignKey(
                name: "FK_Days_Families_FamilyId",
                table: "Days",
                column: "FamilyId",
                principalTable: "Families",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Subjects_Families_FamilyId",
                table: "Subjects",
                column: "FamilyId",
                principalTable: "Families",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        // Geri alma: ailenin planı ailenin yöneticisine (IsAdmin) kişisel plan olarak verilir.
        // Birleştirilmiş günler ve teke indirilmiş dersler eski haline ayrılamaz.
        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(name: "FK_Days_Families_FamilyId", table: "Days");
            migrationBuilder.DropForeignKey(name: "FK_Subjects_Families_FamilyId", table: "Subjects");
            migrationBuilder.DropIndex(name: "IX_Days_FamilyId_Date", table: "Days");
            migrationBuilder.DropIndex(name: "IX_Subjects_FamilyId", table: "Subjects");

            migrationBuilder.RenameColumn(name: "FamilyId", table: "Days", newName: "MemberId");
            migrationBuilder.RenameColumn(name: "FamilyId", table: "Subjects", newName: "MemberId");

            migrationBuilder.Sql("""
                UPDATE "Days" d SET "MemberId" = m."Id"
                FROM "FamilyMembers" m WHERE m."FamilyId" = d."MemberId" AND m."IsAdmin";
                UPDATE "Subjects" s SET "MemberId" = m."Id"
                FROM "FamilyMembers" m WHERE m."FamilyId" = s."MemberId" AND m."IsAdmin";
                """);

            migrationBuilder.CreateIndex(name: "IX_Days_MemberId_Date", table: "Days", columns: new[] { "MemberId", "Date" }, unique: true);
            migrationBuilder.CreateIndex(name: "IX_Subjects_MemberId", table: "Subjects", column: "MemberId");

            migrationBuilder.AddForeignKey(
                name: "FK_Days_FamilyMembers_MemberId",
                table: "Days",
                column: "MemberId",
                principalTable: "FamilyMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Subjects_FamilyMembers_MemberId",
                table: "Subjects",
                column: "MemberId",
                principalTable: "FamilyMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
