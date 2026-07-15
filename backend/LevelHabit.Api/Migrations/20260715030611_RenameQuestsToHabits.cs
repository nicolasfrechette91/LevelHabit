using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LevelHabit.Api.Migrations;

/// <inheritdoc />
public partial class RenameQuestsToHabits : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        DropForeignKeysAndPrimaryKeys(migrationBuilder, useHabitNames: false);

        migrationBuilder.RenameTable(name: "quests", newName: "habits");
        migrationBuilder.RenameTable(name: "quest_completions", newName: "habit_completions");
        migrationBuilder.RenameTable(name: "quest_reminders", newName: "habit_reminders");

        migrationBuilder.RenameColumn(
            name: "quest_id",
            table: "habit_completions",
            newName: "habit_id");
        migrationBuilder.RenameColumn(
            name: "quest_id",
            table: "habit_reminders",
            newName: "habit_id");
        migrationBuilder.RenameColumn(
            name: "quest_id",
            table: "notifications",
            newName: "habit_id");

        RenameIndexesToHabitNames(migrationBuilder);
        AddForeignKeysAndPrimaryKeys(migrationBuilder, useHabitNames: true);
        UpdateAchievementTerminology(migrationBuilder, useHabitTerminology: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        DropForeignKeysAndPrimaryKeys(migrationBuilder, useHabitNames: true);

        RenameIndexesToQuestNames(migrationBuilder);

        migrationBuilder.RenameColumn(
            name: "habit_id",
            table: "habit_completions",
            newName: "quest_id");
        migrationBuilder.RenameColumn(
            name: "habit_id",
            table: "habit_reminders",
            newName: "quest_id");
        migrationBuilder.RenameColumn(
            name: "habit_id",
            table: "notifications",
            newName: "quest_id");

        migrationBuilder.RenameTable(name: "habits", newName: "quests");
        migrationBuilder.RenameTable(name: "habit_completions", newName: "quest_completions");
        migrationBuilder.RenameTable(name: "habit_reminders", newName: "quest_reminders");

        AddForeignKeysAndPrimaryKeys(migrationBuilder, useHabitNames: false);
        UpdateAchievementTerminology(migrationBuilder, useHabitTerminology: false);
    }

    private static void DropForeignKeysAndPrimaryKeys(
        MigrationBuilder migrationBuilder,
        bool useHabitNames)
    {
        string entityTable = useHabitNames ? "habits" : "quests";
        string completionTable = useHabitNames ? "habit_completions" : "quest_completions";
        string reminderTable = useHabitNames ? "habit_reminders" : "quest_reminders";
        string entityName = useHabitNames ? "habits" : "quests";
        string entityId = useHabitNames ? "habit_id" : "quest_id";

        migrationBuilder.DropForeignKey(
            name: $"FK_notifications_{entityName}_{entityId}",
            table: "notifications");
        migrationBuilder.DropForeignKey(
            name: $"FK_{completionTable}_{entityName}_{entityId}",
            table: completionTable);
        migrationBuilder.DropForeignKey(
            name: $"FK_{completionTable}_users_user_id",
            table: completionTable);
        migrationBuilder.DropForeignKey(
            name: $"FK_{reminderTable}_{entityName}_{entityId}",
            table: reminderTable);
        migrationBuilder.DropForeignKey(
            name: $"FK_{reminderTable}_users_user_id",
            table: reminderTable);
        migrationBuilder.DropForeignKey(
            name: $"FK_{entityTable}_users_user_id",
            table: entityTable);

        migrationBuilder.DropPrimaryKey(name: $"PK_{completionTable}", table: completionTable);
        migrationBuilder.DropPrimaryKey(name: $"PK_{reminderTable}", table: reminderTable);
        migrationBuilder.DropPrimaryKey(name: $"PK_{entityTable}", table: entityTable);
    }

    private static void AddForeignKeysAndPrimaryKeys(
        MigrationBuilder migrationBuilder,
        bool useHabitNames)
    {
        string entityTable = useHabitNames ? "habits" : "quests";
        string completionTable = useHabitNames ? "habit_completions" : "quest_completions";
        string reminderTable = useHabitNames ? "habit_reminders" : "quest_reminders";
        string entityId = useHabitNames ? "habit_id" : "quest_id";

        migrationBuilder.AddPrimaryKey(name: $"PK_{entityTable}", table: entityTable, column: "id");
        migrationBuilder.AddPrimaryKey(name: $"PK_{completionTable}", table: completionTable, column: "id");
        migrationBuilder.AddPrimaryKey(name: $"PK_{reminderTable}", table: reminderTable, column: "id");

        migrationBuilder.AddForeignKey(
            name: $"FK_{entityTable}_users_user_id",
            table: entityTable,
            column: "user_id",
            principalTable: "users",
            principalColumn: "id",
            onDelete: ReferentialAction.Cascade);
        migrationBuilder.AddForeignKey(
            name: $"FK_{completionTable}_{entityTable}_{entityId}",
            table: completionTable,
            column: entityId,
            principalTable: entityTable,
            principalColumn: "id",
            onDelete: ReferentialAction.Cascade);
        migrationBuilder.AddForeignKey(
            name: $"FK_{completionTable}_users_user_id",
            table: completionTable,
            column: "user_id",
            principalTable: "users",
            principalColumn: "id",
            onDelete: ReferentialAction.Cascade);
        migrationBuilder.AddForeignKey(
            name: $"FK_{reminderTable}_{entityTable}_{entityId}",
            table: reminderTable,
            column: entityId,
            principalTable: entityTable,
            principalColumn: "id",
            onDelete: ReferentialAction.Cascade);
        migrationBuilder.AddForeignKey(
            name: $"FK_{reminderTable}_users_user_id",
            table: reminderTable,
            column: "user_id",
            principalTable: "users",
            principalColumn: "id",
            onDelete: ReferentialAction.Cascade);
        migrationBuilder.AddForeignKey(
            name: $"FK_notifications_{entityTable}_{entityId}",
            table: "notifications",
            column: entityId,
            principalTable: entityTable,
            principalColumn: "id",
            onDelete: ReferentialAction.SetNull);
    }

    private static void RenameIndexesToHabitNames(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.RenameIndex(name: "IX_quests_user_id_is_archived", table: "habits", newName: "IX_habits_user_id_is_archived");
        migrationBuilder.RenameIndex(name: "IX_quest_completions_quest_id", table: "habit_completions", newName: "IX_habit_completions_habit_id");
        migrationBuilder.RenameIndex(name: "IX_quest_completions_user_id_quest_id_completion_date_utc", table: "habit_completions", newName: "IX_habit_completions_user_id_habit_id_completion_date_utc");
        migrationBuilder.RenameIndex(name: "IX_quest_reminders_quest_id", table: "habit_reminders", newName: "IX_habit_reminders_habit_id");
        migrationBuilder.RenameIndex(name: "IX_quest_reminders_is_enabled_next_trigger_at_utc", table: "habit_reminders", newName: "IX_habit_reminders_is_enabled_next_trigger_at_utc");
        migrationBuilder.RenameIndex(name: "IX_quest_reminders_user_id", table: "habit_reminders", newName: "IX_habit_reminders_user_id");
        migrationBuilder.RenameIndex(name: "IX_notifications_quest_id", table: "notifications", newName: "IX_notifications_habit_id");
    }

    private static void RenameIndexesToQuestNames(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.RenameIndex(name: "IX_habits_user_id_is_archived", table: "habits", newName: "IX_quests_user_id_is_archived");
        migrationBuilder.RenameIndex(name: "IX_habit_completions_habit_id", table: "habit_completions", newName: "IX_quest_completions_quest_id");
        migrationBuilder.RenameIndex(name: "IX_habit_completions_user_id_habit_id_completion_date_utc", table: "habit_completions", newName: "IX_quest_completions_user_id_quest_id_completion_date_utc");
        migrationBuilder.RenameIndex(name: "IX_habit_reminders_habit_id", table: "habit_reminders", newName: "IX_quest_reminders_quest_id");
        migrationBuilder.RenameIndex(name: "IX_habit_reminders_is_enabled_next_trigger_at_utc", table: "habit_reminders", newName: "IX_quest_reminders_is_enabled_next_trigger_at_utc");
        migrationBuilder.RenameIndex(name: "IX_habit_reminders_user_id", table: "habit_reminders", newName: "IX_quest_reminders_user_id");
        migrationBuilder.RenameIndex(name: "IX_notifications_habit_id", table: "notifications", newName: "IX_notifications_quest_id");
    }

    private static void UpdateAchievementTerminology(
        MigrationBuilder migrationBuilder,
        bool useHabitTerminology)
    {
        string singular = useHabitTerminology ? "habit" : "quest";
        string plural = useHabitTerminology ? "habits" : "quests";

        migrationBuilder.UpdateData(table: "achievements", keyColumn: "key", keyValue: "balanced-progress", column: "description", value: $"Complete {plural} in at least 3 different categories.");
        migrationBuilder.UpdateData(table: "achievements", keyColumn: "key", keyValue: "dedicated", column: "description", value: $"Complete 25 {plural} total.");
        migrationBuilder.UpdateData(table: "achievements", keyColumn: "key", keyValue: "first-step", column: "description", value: $"Complete your first {singular}.");
        migrationBuilder.UpdateData(table: "achievements", keyColumn: "key", keyValue: "getting-started", column: "description", value: $"Complete 5 {plural} total.");
        migrationBuilder.UpdateData(table: "achievements", keyColumn: "key", keyValue: "hard-mode", column: "description", value: $"Complete a hard {singular}.");
        migrationBuilder.UpdateData(table: "achievements", keyColumn: "key", keyValue: "on-fire", columns: ["description", "rule"], values: [$"Reach a 3-day streak on any {singular}.", $"best-{singular}-streak"]);
        migrationBuilder.UpdateData(table: "achievements", keyColumn: "key", keyValue: "unstoppable", columns: ["description", "rule"], values: [$"Reach a 7-day streak on any {singular}.", $"best-{singular}-streak"]);
    }
}
