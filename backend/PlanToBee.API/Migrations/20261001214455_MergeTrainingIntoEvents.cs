using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PlanToBee.API.Migrations
{
    // Antrenmanlar etkinliklere katılır: her TrainingEntry, aynı gün, tür, süre, not ve kayıt iziyle (ekleyen,
    // düzenleyen, zamanları, "aktarıldı") Kind = 'Training' olan bir Event satırına kopyalanır. Saat boş kalır.
    // - Ya hep ya hiç: migration tek transaction'dadır; aile bazında sayı ve toplam dakika tutmazsa hata verir ve
    //   hiçbir değişiklik kalmaz.
    // - TrainingEntries tablosu silinmez; bir sürüm yedek olarak bekler (uygulama artık okumaz).
    // - Geri alma: taşınan antrenman etkinlikleri silinir, sütunlar kaldırılır. Taşımadan sonra eklenen ya da
    //   düzenlenen antrenmanlar eski tabloda olmadığı için kaybolur.
    /// <inheritdoc />
    public partial class MergeTrainingIntoEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Kind",
                table: "Events",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Event");

            migrationBuilder.AddColumn<int>(
                name: "Minutes",
                table: "Events",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TrainingType",
                table: "Events",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.Sql("""
                INSERT INTO "Events" ("DayId", "Kind", "Title", "Time", "Note", "TrainingType", "Minutes",
                                      "CreatedByMemberId", "CreatedAt", "UpdatedByMemberId", "UpdatedAt", "IsImported")
                SELECT "DayId", 'Training', '', '', "Note", "Type", "Minutes",
                       "CreatedByMemberId", "CreatedAt", "UpdatedByMemberId", "UpdatedAt", "IsImported"
                FROM "TrainingEntries"
                ORDER BY "Id";
                """);

            // Kontrol: aile bazında antrenman sayısı ve toplam dakika taşımadan önce ve sonra aynı olmalı.
            migrationBuilder.Sql("""
                DO $$
                DECLARE mismatches integer;
                BEGIN
                    SELECT count(*) INTO mismatches FROM (
                        SELECT d."FamilyId", count(*) AS n, coalesce(sum(t."Minutes"), 0) AS mins
                        FROM "TrainingEntries" t JOIN "Days" d ON d."Id" = t."DayId" GROUP BY d."FamilyId"
                        EXCEPT
                        SELECT d."FamilyId", count(*), coalesce(sum(e."Minutes"), 0)
                        FROM "Events" e JOIN "Days" d ON d."Id" = e."DayId" WHERE e."Kind" = 'Training' GROUP BY d."FamilyId"
                    ) diff;
                    IF mismatches > 0 THEN
                        RAISE EXCEPTION 'Antrenman taşıma kontrolü başarısız: % ailede sayı ya da süre tutmuyor', mismatches;
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""DELETE FROM "Events" WHERE "Kind" = 'Training';""");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "Minutes",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "TrainingType",
                table: "Events");
        }
    }
}
