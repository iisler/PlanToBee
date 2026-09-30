using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PlanToBee.API.Migrations
{
    // FamilyMembers.FamilyId üzerindeki tek indeks kısmi (yalnızca IsAdmin satırları) olduğu için ailenin
    // üyelerini listeleyen sorgular ve Families silinirken yapılan FK taraması tüm tabloyu tarıyordu.
    // Yalnızca indeks ekler; veriyi değiştirmez.
    /// <inheritdoc />
    public partial class FamilyMemberFamilyIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_FamilyMembers_FamilyId_Status",
                table: "FamilyMembers",
                columns: new[] { "FamilyId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FamilyMembers_FamilyId_Status",
                table: "FamilyMembers");
        }
    }
}
