using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LevelHabit.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSixDigitEmailVerificationCodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<bool>(
                name: "email_confirmed",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: false,
                oldClrType: typeof(bool),
                oldType: "boolean");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "email_verification_code_expires_at_utc",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "email_verification_code_hash",
                table: "users",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "email_verification_code_last_sent_at_utc",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "email_verification_failed_attempts",
                table: "users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(
                """
                UPDATE users
                SET
                    email_confirmed = TRUE,
                    email_confirmed_at_utc = COALESCE(email_confirmed_at_utc, updated_at_utc, created_at_utc)
                WHERE email_confirmed = FALSE;
                """);

            migrationBuilder.Sql(
                "DELETE FROM auth_tokens WHERE purpose = 'email_verification';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "email_verification_code_expires_at_utc",
                table: "users");

            migrationBuilder.DropColumn(
                name: "email_verification_code_hash",
                table: "users");

            migrationBuilder.DropColumn(
                name: "email_verification_code_last_sent_at_utc",
                table: "users");

            migrationBuilder.DropColumn(
                name: "email_verification_failed_attempts",
                table: "users");

            migrationBuilder.AlterColumn<bool>(
                name: "email_confirmed",
                table: "users",
                type: "boolean",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "boolean",
                oldDefaultValue: false);
        }
    }
}
