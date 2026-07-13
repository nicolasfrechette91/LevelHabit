using System.Reflection;
using LevelHabit.Api.Migrations;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;

namespace LevelHabit.Api.Tests;

public sealed class EmailVerificationMigrationTests
{
    [Fact]
    public void AddSixDigitEmailVerificationCodes_confirms_existing_users()
    {
        AddSixDigitEmailVerificationCodes migration = new();
        MigrationBuilder migrationBuilder = new("Npgsql.EntityFrameworkCore.PostgreSQL");
        MethodInfo upMethod = typeof(AddSixDigitEmailVerificationCodes).GetMethod(
            "Up",
            BindingFlags.Instance | BindingFlags.NonPublic)
            ?? throw new InvalidOperationException("Migration Up method was not found.");

        upMethod.Invoke(migration, [migrationBuilder]);

        Assert.Contains(
            migrationBuilder.Operations.OfType<SqlOperation>(),
            operation =>
                operation.Sql.Contains("UPDATE users", StringComparison.OrdinalIgnoreCase)
                && operation.Sql.Contains("email_confirmed = TRUE", StringComparison.OrdinalIgnoreCase));
    }
}
