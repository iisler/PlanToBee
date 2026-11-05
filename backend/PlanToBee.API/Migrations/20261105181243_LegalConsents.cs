using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PlanToBee.API.Migrations
{
    /// <inheritdoc />
    public partial class LegalConsents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ConsentsAcceptedAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "IsKvkkChecked",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "IsTermsAccepted",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Users_IsKvkkChecked",
                table: "Users",
                sql: "\"IsKvkkChecked\" IN (0, 1)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Users_IsTermsAccepted",
                table: "Users",
                sql: "\"IsTermsAccepted\" IN (0, 1)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Users_IsKvkkChecked",
                table: "Users");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Users_IsTermsAccepted",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ConsentsAcceptedAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "IsKvkkChecked",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "IsTermsAccepted",
                table: "Users");
        }
    }
}
