using System;
using LevelHabit.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LevelHabit.Api.Migrations;

[DbContext(typeof(LevelHabitDbContext))]
[Migration("20260618013000_AddQuests")]
public partial class AddQuests : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "quests",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                user_id = table.Column<Guid>(type: "uuid", nullable: false),
                title = table.Column<string>(type: "character varying(140)", maxLength: 140, nullable: false),
                description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                category = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                difficulty = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                frequency = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                is_archived = table.Column<bool>(type: "boolean", nullable: false),
                created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_quests", x => x.id);
                table.ForeignKey(
                    name: "FK_quests_users_user_id",
                    column: x => x.user_id,
                    principalTable: "users",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_quests_user_id_is_archived",
            table: "quests",
            columns: new[] { "user_id", "is_archived" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "quests");
    }
}
