using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PlanToBee.API.Migrations
{
    /// <inheritdoc />
    public partial class EventEndTime : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EndTime",
                table: "Events",
                type: "character varying(5)",
                maxLength: 5,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EndTime",
                table: "Events");
        }
    }
}
