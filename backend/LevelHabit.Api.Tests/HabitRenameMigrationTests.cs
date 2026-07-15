using System.Reflection;
using LevelHabit.Api.Migrations;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;

namespace LevelHabit.Api.Tests;

public sealed class HabitRenameMigrationTests
{
    [Fact]
    public void RenameQuestsToHabits_renames_schema_without_recreating_data_tables()
    {
        RenameQuestsToHabits migration = new();
        MigrationBuilder migrationBuilder = new("Npgsql.EntityFrameworkCore.PostgreSQL");
        MethodInfo upMethod = typeof(RenameQuestsToHabits).GetMethod(
            "Up",
            BindingFlags.Instance | BindingFlags.NonPublic)
            ?? throw new InvalidOperationException("Migration Up method was not found.");

        upMethod.Invoke(migration, [migrationBuilder]);

        Assert.DoesNotContain(
            migrationBuilder.Operations,
            operation => operation is DropTableOperation or CreateTableOperation or DropColumnOperation);

        Assert.Equal(
            3,
            migrationBuilder.Operations.OfType<RenameTableOperation>().Count());
        Assert.Equal(
            3,
            migrationBuilder.Operations.OfType<RenameColumnOperation>().Count());
        Assert.Equal(
            7,
            migrationBuilder.Operations.OfType<RenameIndexOperation>().Count());
    }
}
