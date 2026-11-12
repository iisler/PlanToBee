using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PlanToBee.API.Migrations
{
    /// <inheritdoc />
    public partial class ConsentVersions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "KvkkReadAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "KvkkVersion",
                table: "Users",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TermsAcceptedAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TermsVersion",
                table: "Users",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "KvkkReadAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "KvkkVersion",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "TermsAcceptedAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "TermsVersion",
                table: "Users");
        }
    }
}
