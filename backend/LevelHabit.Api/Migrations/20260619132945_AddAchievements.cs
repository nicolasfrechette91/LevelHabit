using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace LevelHabit.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAchievements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "achievements",
                columns: table => new
                {
                    key = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    title = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    rule = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    target = table.Column<int>(type: "integer", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_achievements", x => x.key);
                });

            migrationBuilder.CreateTable(
                name: "user_achievements",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    achievement_key = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    unlocked_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_achievements", x => x.id);
                    table.ForeignKey(
                        name: "FK_user_achievements_achievements_achievement_key",
                        column: x => x.achievement_key,
                        principalTable: "achievements",
                        principalColumn: "key",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_user_achievements_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "achievements",
                columns: new[] { "key", "description", "rule", "sort_order", "target", "title" },
                values: new object[,]
                {
                    { "balanced-hero", "Complete quests in at least 3 different categories.", "completed-categories", 90, 3, "Balanced Hero" },
                    { "dedicated", "Complete 25 quests total.", "total-completions", 30, 25, "Dedicated" },
                    { "first-step", "Complete your first quest.", "total-completions", 10, 1, "First Step" },
                    { "getting-started", "Complete 5 quests total.", "total-completions", 20, 5, "Getting Started" },
                    { "hard-mode", "Complete a hard quest.", "hard-completion", 80, 1, "Hard Mode" },
                    { "hero-rising", "Reach hero level 5.", "level", 50, 5, "Hero Rising" },
                    { "level-up", "Reach hero level 2.", "level", 40, 2, "Level Up" },
                    { "on-fire", "Reach a 3-day streak on any quest.", "best-quest-streak", 60, 3, "On Fire" },
                    { "unstoppable", "Reach a 7-day streak on any quest.", "best-quest-streak", 70, 7, "Unstoppable" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_achievements_sort_order",
                table: "achievements",
                column: "sort_order");

            migrationBuilder.CreateIndex(
                name: "IX_user_achievements_achievement_key",
                table: "user_achievements",
                column: "achievement_key");

            migrationBuilder.CreateIndex(
                name: "IX_user_achievements_user_id_achievement_key",
                table: "user_achievements",
                columns: new[] { "user_id", "achievement_key" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_achievements");

            migrationBuilder.DropTable(
                name: "achievements");
        }
    }
}
