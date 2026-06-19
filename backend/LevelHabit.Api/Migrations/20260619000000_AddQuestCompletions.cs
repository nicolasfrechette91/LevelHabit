using System;
using LevelHabit.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LevelHabit.Api.Migrations;

[DbContext(typeof(LevelHabitDbContext))]
[Migration("20260619000000_AddQuestCompletions")]
public partial class AddQuestCompletions : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "quest_completions",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                user_id = table.Column<Guid>(type: "uuid", nullable: false),
                quest_id = table.Column<Guid>(type: "uuid", nullable: false),
                completion_date_utc = table.Column<DateOnly>(type: "date", nullable: false),
                completed_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_quest_completions", x => x.id);
                table.ForeignKey(
                    name: "FK_quest_completions_quests_quest_id",
                    column: x => x.quest_id,
                    principalTable: "quests",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "FK_quest_completions_users_user_id",
                    column: x => x.user_id,
                    principalTable: "users",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_quest_completions_quest_id",
            table: "quest_completions",
            column: "quest_id");

        migrationBuilder.CreateIndex(
            name: "IX_quest_completions_user_id_quest_id_completion_date_utc",
            table: "quest_completions",
            columns: new[] { "user_id", "quest_id", "completion_date_utc" },
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "quest_completions");
    }
}
