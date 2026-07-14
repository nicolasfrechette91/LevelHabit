using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LevelHabit.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddQuestRemindersAndNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "notifications",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quest_id = table.Column<Guid>(type: "uuid", nullable: true),
                    type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    title = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    is_read = table.Column<bool>(type: "boolean", nullable: false),
                    created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    read_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    reference_url = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    deduplication_key = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notifications", x => x.id);
                    table.ForeignKey(
                        name: "FK_notifications_quests_quest_id",
                        column: x => x.quest_id,
                        principalTable: "quests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_notifications_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "quest_reminders",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quest_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    time_of_day = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    time_zone_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    days_of_week = table.Column<int>(type: "integer", nullable: false),
                    last_triggered_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    next_trigger_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_quest_reminders", x => x.id);
                    table.ForeignKey(
                        name: "FK_quest_reminders_quests_quest_id",
                        column: x => x.quest_id,
                        principalTable: "quests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_quest_reminders_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_notifications_quest_id",
                table: "notifications",
                column: "quest_id");

            migrationBuilder.CreateIndex(
                name: "IX_notifications_user_id_deduplication_key",
                table: "notifications",
                columns: new[] { "user_id", "deduplication_key" },
                unique: true,
                filter: "deduplication_key IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_notifications_user_id_is_read_created_at_utc",
                table: "notifications",
                columns: new[] { "user_id", "is_read", "created_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_quest_reminders_is_enabled_next_trigger_at_utc",
                table: "quest_reminders",
                columns: new[] { "is_enabled", "next_trigger_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_quest_reminders_quest_id",
                table: "quest_reminders",
                column: "quest_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_quest_reminders_user_id",
                table: "quest_reminders",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "notifications");

            migrationBuilder.DropTable(
                name: "quest_reminders");
        }
    }
}
