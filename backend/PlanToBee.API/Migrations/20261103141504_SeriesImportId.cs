using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PlanToBee.API.Migrations
{
    /// <inheritdoc />
    public partial class SeriesImportId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ImportId",
                table: "EventSeries",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_EventSeries_ImportId",
                table: "EventSeries",
                column: "ImportId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_EventSeries_ImportId",
                table: "EventSeries");

            migrationBuilder.DropColumn(
                name: "ImportId",
                table: "EventSeries");
        }
    }
}
