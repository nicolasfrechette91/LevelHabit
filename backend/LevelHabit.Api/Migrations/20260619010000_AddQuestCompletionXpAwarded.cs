using LevelHabit.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LevelHabit.Api.Migrations;

[DbContext(typeof(LevelHabitDbContext))]
[Migration("20260619010000_AddQuestCompletionXpAwarded")]
public partial class AddQuestCompletionXpAwarded : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "xp_awarded",
            table: "quest_completions",
            type: "integer",
            nullable: false,
            defaultValue: 0);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "xp_awarded",
            table: "quest_completions");
    }
}
