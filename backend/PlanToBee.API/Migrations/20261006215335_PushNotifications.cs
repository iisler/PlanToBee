using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace PlanToBee.API.Migrations
{
    /// <inheritdoc />
    public partial class PushNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "NotificationPreferences",
                columns: table => new
                {
                    MemberId = table.Column<int>(type: "integer", nullable: false),
                    StudyAdded = table.Column<bool>(type: "boolean", nullable: false),
                    ActivityAdded = table.Column<bool>(type: "boolean", nullable: false),
                    Changes = table.Column<bool>(type: "boolean", nullable: false),
                    StudyDone = table.Column<bool>(type: "boolean", nullable: false),
                    QuietEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    QuietStart = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    QuietEnd = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    MutedMemberIds = table.Column<List<int>>(type: "integer[]", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationPreferences", x => x.MemberId);
                    table.ForeignKey(
                        name: "FK_NotificationPreferences_FamilyMembers_MemberId",
                        column: x => x.MemberId,
                        principalTable: "FamilyMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PendingNotifications",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FamilyId = table.Column<int>(type: "integer", nullable: false),
                    RecipientMemberId = table.Column<int>(type: "integer", nullable: false),
                    ActorMemberId = table.Column<int>(type: "integer", nullable: false),
                    ActorName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Category = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Title = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Body = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    HoldUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PendingNotifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PendingNotifications_Families_FamilyId",
                        column: x => x.FamilyId,
                        principalTable: "Families",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PendingNotifications_FamilyMembers_RecipientMemberId",
                        column: x => x.RecipientMemberId,
                        principalTable: "FamilyMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PushSubscriptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FamilyId = table.Column<int>(type: "integer", nullable: false),
                    MemberId = table.Column<int>(type: "integer", nullable: false),
                    Endpoint = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    EndpointIndex = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    P256dh = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Auth = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    DeviceLabel = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastSuccessAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PushSubscriptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PushSubscriptions_Families_FamilyId",
                        column: x => x.FamilyId,
                        principalTable: "Families",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PushSubscriptions_FamilyMembers_MemberId",
                        column: x => x.MemberId,
                        principalTable: "FamilyMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PendingNotifications_FamilyId",
                table: "PendingNotifications",
                column: "FamilyId");

            migrationBuilder.CreateIndex(
                name: "IX_PendingNotifications_RecipientMemberId",
                table: "PendingNotifications",
                column: "RecipientMemberId");

            migrationBuilder.CreateIndex(
                name: "IX_PushSubscriptions_EndpointIndex",
                table: "PushSubscriptions",
                column: "EndpointIndex",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PushSubscriptions_FamilyId",
                table: "PushSubscriptions",
                column: "FamilyId");

            migrationBuilder.CreateIndex(
                name: "IX_PushSubscriptions_MemberId",
                table: "PushSubscriptions",
                column: "MemberId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "NotificationPreferences");

            migrationBuilder.DropTable(
                name: "PendingNotifications");

            migrationBuilder.DropTable(
                name: "PushSubscriptions");
        }
    }
}
