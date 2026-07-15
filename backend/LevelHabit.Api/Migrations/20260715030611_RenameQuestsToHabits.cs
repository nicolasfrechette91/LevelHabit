using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LevelHabit.Api.Migrations;

/// <inheritdoc />
public partial class RenameQuestsToHabits : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        DropQuestConstraints(migrationBuilder);

        migrationBuilder.RenameTable(
            name: "quests",
            newName: "habits");

        migrationBuilder.RenameTable(
            name: "quest_completions",
            newName: "habit_completions");

        migrationBuilder.RenameTable(
            name: "quest_reminders",
            newName: "habit_reminders");

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
        AddHabitConstraints(migrationBuilder);

        UpdateAchievementTerminology(
            migrationBuilder,
            useHabitTerminology: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        DropHabitConstraints(migrationBuilder);

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

        migrationBuilder.RenameTable(
            name: "habits",
            newName: "quests");

        migrationBuilder.RenameTable(
            name: "habit_completions",
            newName: "quest_completions");

        migrationBuilder.RenameTable(
            name: "habit_reminders",
            newName: "quest_reminders");

        AddQuestConstraints(migrationBuilder);

        UpdateAchievementTerminology(
            migrationBuilder,
            useHabitTerminology: false);
    }

    private static void DropQuestConstraints(
        MigrationBuilder migrationBuilder)
    {
        DropConstraintIfExists(
            migrationBuilder,
            table: "notifications",
            constraintName: "FK_notifications_quests_quest_id");

        DropConstraintIfExists(
            migrationBuilder,
            table: "notifications",
            constraintName: "fk_notifications_quests_quest_id");

        DropConstraintIfExists(
            migrationBuilder,
            table: "quest_completions",
            constraintName: "FK_quest_completions_quests_quest_id");

        DropConstraintIfExists(
            migrationBuilder,
            table: "quest_completions",
            constraintName: "fk_quest_completions_quests_quest_id");

        DropConstraintIfExists(
            migrationBuilder,
            table: "quest_completions",
            constraintName: "FK_quest_completions_users_user_id");

        DropConstraintIfExists(
            migrationBuilder,
            table: "quest_completions",
            constraintName: "fk_quest_completions_users_user_id");

        DropConstraintIfExists(
            migrationBuilder,
            table: "quest_reminders",
            constraintName: "FK_quest_reminders_quests_quest_id");

        DropConstraintIfExists(
            migrationBuilder,
            table: "quest_reminders",
            constraintName: "fk_quest_reminders_quests_quest_id");

        DropConstraintIfExists(
            migrationBuilder,
            table: "quest_reminders",
            constraintName: "FK_quest_reminders_users_user_id");

        DropConstraintIfExists(
            migrationBuilder,
            table: "quest_reminders",
            constraintName: "fk_quest_reminders_users_user_id");

        DropConstraintIfExists(
            migrationBuilder,
            table: "quests",
            constraintName: "FK_quests_users_user_id");

        DropConstraintIfExists(
            migrationBuilder,
            table: "quests",
            constraintName: "fk_quests_users_user_id");

        DropConstraintIfExists(
            migrationBuilder,
            table: "quest_completions",
            constraintName: "PK_quest_completions");

        DropConstraintIfExists(
            migrationBuilder,
            table: "quest_completions",
            constraintName: "pk_quest_completions");

        DropConstraintIfExists(
            migrationBuilder,
            table: "quest_reminders",
            constraintName: "PK_quest_reminders");

        DropConstraintIfExists(
            migrationBuilder,
            table: "quest_reminders",
            constraintName: "pk_quest_reminders");

        DropConstraintIfExists(
            migrationBuilder,
            table: "quests",
            constraintName: "PK_quests");

        DropConstraintIfExists(
            migrationBuilder,
            table: "quests",
            constraintName: "pk_quests");
    }

    private static void DropHabitConstraints(
        MigrationBuilder migrationBuilder)
    {
        DropConstraintIfExists(
            migrationBuilder,
            table: "notifications",
            constraintName: "fk_notifications_habits_habit_id");

        DropConstraintIfExists(
            migrationBuilder,
            table: "habit_completions",
            constraintName: "fk_habit_completions_habits_habit_id");

        DropConstraintIfExists(
            migrationBuilder,
            table: "habit_completions",
            constraintName: "fk_habit_completions_users_user_id");

        DropConstraintIfExists(
            migrationBuilder,
            table: "habit_reminders",
            constraintName: "fk_habit_reminders_habits_habit_id");

        DropConstraintIfExists(
            migrationBuilder,
            table: "habit_reminders",
            constraintName: "fk_habit_reminders_users_user_id");

        DropConstraintIfExists(
            migrationBuilder,
            table: "habits",
            constraintName: "fk_habits_users_user_id");

        DropConstraintIfExists(
            migrationBuilder,
            table: "habit_completions",
            constraintName: "pk_habit_completions");

        DropConstraintIfExists(
            migrationBuilder,
            table: "habit_reminders",
            constraintName: "pk_habit_reminders");

        DropConstraintIfExists(
            migrationBuilder,
            table: "habits",
            constraintName: "pk_habits");
    }

    private static void AddHabitConstraints(
        MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddPrimaryKey(
            name: "pk_habits",
            table: "habits",
            column: "id");

        migrationBuilder.AddPrimaryKey(
            name: "pk_habit_completions",
            table: "habit_completions",
            column: "id");

        migrationBuilder.AddPrimaryKey(
            name: "pk_habit_reminders",
            table: "habit_reminders",
            column: "id");

        migrationBuilder.AddForeignKey(
            name: "fk_habits_users_user_id",
            table: "habits",
            column: "user_id",
            principalTable: "users",
            principalColumn: "id",
            onDelete: ReferentialAction.Cascade);

        migrationBuilder.AddForeignKey(
            name: "fk_habit_completions_habits_habit_id",
            table: "habit_completions",
            column: "habit_id",
            principalTable: "habits",
            principalColumn: "id",
            onDelete: ReferentialAction.Cascade);

        migrationBuilder.AddForeignKey(
            name: "fk_habit_completions_users_user_id",
            table: "habit_completions",
            column: "user_id",
            principalTable: "users",
            principalColumn: "id",
            onDelete: ReferentialAction.Cascade);

        migrationBuilder.AddForeignKey(
            name: "fk_habit_reminders_habits_habit_id",
            table: "habit_reminders",
            column: "habit_id",
            principalTable: "habits",
            principalColumn: "id",
            onDelete: ReferentialAction.Cascade);

        migrationBuilder.AddForeignKey(
            name: "fk_habit_reminders_users_user_id",
            table: "habit_reminders",
            column: "user_id",
            principalTable: "users",
            principalColumn: "id",
            onDelete: ReferentialAction.Cascade);

        migrationBuilder.AddForeignKey(
            name: "fk_notifications_habits_habit_id",
            table: "notifications",
            column: "habit_id",
            principalTable: "habits",
            principalColumn: "id",
            onDelete: ReferentialAction.SetNull);
    }

    private static void AddQuestConstraints(
        MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddPrimaryKey(
            name: "pk_quests",
            table: "quests",
            column: "id");

        migrationBuilder.AddPrimaryKey(
            name: "PK_quest_completions",
            table: "quest_completions",
            column: "id");

        migrationBuilder.AddPrimaryKey(
            name: "PK_quest_reminders",
            table: "quest_reminders",
            column: "id");

        migrationBuilder.AddForeignKey(
            name: "fk_quests_users_user_id",
            table: "quests",
            column: "user_id",
            principalTable: "users",
            principalColumn: "id",
            onDelete: ReferentialAction.Cascade);

        migrationBuilder.AddForeignKey(
            name: "FK_quest_completions_quests_quest_id",
            table: "quest_completions",
            column: "quest_id",
            principalTable: "quests",
            principalColumn: "id",
            onDelete: ReferentialAction.Cascade);

        migrationBuilder.AddForeignKey(
            name: "FK_quest_completions_users_user_id",
            table: "quest_completions",
            column: "user_id",
            principalTable: "users",
            principalColumn: "id",
            onDelete: ReferentialAction.Cascade);

        migrationBuilder.AddForeignKey(
            name: "FK_quest_reminders_quests_quest_id",
            table: "quest_reminders",
            column: "quest_id",
            principalTable: "quests",
            principalColumn: "id",
            onDelete: ReferentialAction.Cascade);

        migrationBuilder.AddForeignKey(
            name: "FK_quest_reminders_users_user_id",
            table: "quest_reminders",
            column: "user_id",
            principalTable: "users",
            principalColumn: "id",
            onDelete: ReferentialAction.Cascade);

        migrationBuilder.AddForeignKey(
            name: "FK_notifications_quests_quest_id",
            table: "notifications",
            column: "quest_id",
            principalTable: "quests",
            principalColumn: "id",
            onDelete: ReferentialAction.SetNull);
    }

    private static void RenameIndexesToHabitNames(
        MigrationBuilder migrationBuilder)
    {
        RenameIndexCaseInsensitive(
            migrationBuilder,
            oldName: "ix_quests_user_id_is_archived",
            newName: "ix_habits_user_id_is_archived");

        RenameIndexCaseInsensitive(
            migrationBuilder,
            oldName: "IX_quest_completions_quest_id",
            newName: "ix_habit_completions_habit_id");

        RenameIndexCaseInsensitive(
            migrationBuilder,
            oldName:
                "IX_quest_completions_user_id_quest_id_completion_date_utc",
            newName:
                "ix_habit_completions_user_id_habit_id_completion_date_utc");

        RenameIndexCaseInsensitive(
            migrationBuilder,
            oldName: "IX_quest_reminders_quest_id",
            newName: "ix_habit_reminders_habit_id");

        RenameIndexCaseInsensitive(
            migrationBuilder,
            oldName:
                "IX_quest_reminders_is_enabled_next_trigger_at_utc",
            newName:
                "ix_habit_reminders_is_enabled_next_trigger_at_utc");

        RenameIndexCaseInsensitive(
            migrationBuilder,
            oldName: "IX_quest_reminders_user_id",
            newName: "ix_habit_reminders_user_id");

        RenameIndexCaseInsensitive(
            migrationBuilder,
            oldName: "IX_notifications_quest_id",
            newName: "ix_notifications_habit_id");
    }

    private static void RenameIndexesToQuestNames(
        MigrationBuilder migrationBuilder)
    {
        RenameIndexCaseInsensitive(
            migrationBuilder,
            oldName: "ix_habits_user_id_is_archived",
            newName: "ix_quests_user_id_is_archived");

        RenameIndexCaseInsensitive(
            migrationBuilder,
            oldName: "ix_habit_completions_habit_id",
            newName: "IX_quest_completions_quest_id");

        RenameIndexCaseInsensitive(
            migrationBuilder,
            oldName:
                "ix_habit_completions_user_id_habit_id_completion_date_utc",
            newName:
                "IX_quest_completions_user_id_quest_id_completion_date_utc");

        RenameIndexCaseInsensitive(
            migrationBuilder,
            oldName: "ix_habit_reminders_habit_id",
            newName: "IX_quest_reminders_quest_id");

        RenameIndexCaseInsensitive(
            migrationBuilder,
            oldName:
                "ix_habit_reminders_is_enabled_next_trigger_at_utc",
            newName:
                "IX_quest_reminders_is_enabled_next_trigger_at_utc");

        RenameIndexCaseInsensitive(
            migrationBuilder,
            oldName: "ix_habit_reminders_user_id",
            newName: "IX_quest_reminders_user_id");

        RenameIndexCaseInsensitive(
            migrationBuilder,
            oldName: "ix_notifications_habit_id",
            newName: "IX_notifications_quest_id");
    }

    private static void RenameIndexCaseInsensitive(
        MigrationBuilder migrationBuilder,
        string oldName,
        string newName)
    {
        string escapedOldName = oldName.Replace("'", "''");
        string escapedNewName = newName.Replace("'", "''");

        migrationBuilder.Sql(
            $"""
             DO $$
             DECLARE
                 actual_index_name text;
             BEGIN
                 SELECT index_class.relname
                 INTO actual_index_name
                 FROM pg_class AS index_class
                 INNER JOIN pg_namespace AS index_namespace
                     ON index_namespace.oid = index_class.relnamespace
                 WHERE index_namespace.nspname = 'public'
                   AND index_class.relkind IN ('i', 'I')
                   AND lower(index_class.relname) =
                       lower('{escapedOldName}')
                 LIMIT 1;

                 IF actual_index_name IS NULL THEN
                     RAISE EXCEPTION
                         'Expected index "{escapedOldName}" was not found in schema public.';
                 END IF;

                 IF EXISTS (
                     SELECT 1
                     FROM pg_class AS target_index
                     INNER JOIN pg_namespace AS target_namespace
                         ON target_namespace.oid =
                            target_index.relnamespace
                     WHERE target_namespace.nspname = 'public'
                       AND target_index.relkind IN ('i', 'I')
                       AND target_index.relname =
                           '{escapedNewName}'
                 ) THEN
                     RAISE EXCEPTION
                         'Target index "{escapedNewName}" already exists in schema public.';
                 END IF;

                 EXECUTE format(
                     'ALTER INDEX public.%I RENAME TO %I',
                     actual_index_name,
                     '{escapedNewName}');
             END
             $$;
             """);
    }

    private static void DropConstraintIfExists(
        MigrationBuilder migrationBuilder,
        string table,
        string constraintName)
    {
        migrationBuilder.Sql(
            $"""
             ALTER TABLE "{table}"
             DROP CONSTRAINT IF EXISTS "{constraintName}";
             """);
    }

    private static void UpdateAchievementTerminology(
        MigrationBuilder migrationBuilder,
        bool useHabitTerminology)
    {
        string singular = useHabitTerminology
            ? "habit"
            : "quest";

        string plural = useHabitTerminology
            ? "habits"
            : "quests";

        migrationBuilder.UpdateData(
            table: "achievements",
            keyColumn: "key",
            keyValue: "balanced-progress",
            column: "description",
            value:
                $"Complete {plural} in at least 3 different categories.");

        migrationBuilder.UpdateData(
            table: "achievements",
            keyColumn: "key",
            keyValue: "dedicated",
            column: "description",
            value: $"Complete 25 {plural} total.");

        migrationBuilder.UpdateData(
            table: "achievements",
            keyColumn: "key",
            keyValue: "first-step",
            column: "description",
            value: $"Complete your first {singular}.");

        migrationBuilder.UpdateData(
            table: "achievements",
            keyColumn: "key",
            keyValue: "getting-started",
            column: "description",
            value: $"Complete 5 {plural} total.");

        migrationBuilder.UpdateData(
            table: "achievements",
            keyColumn: "key",
            keyValue: "hard-mode",
            column: "description",
            value: $"Complete a hard {singular}.");

        migrationBuilder.UpdateData(
            table: "achievements",
            keyColumn: "key",
            keyValue: "on-fire",
            columns: ["description", "rule"],
            values:
            [
                $"Reach a 3-day streak on any {singular}.",
                $"best-{singular}-streak"
            ]);

        migrationBuilder.UpdateData(
            table: "achievements",
            keyColumn: "key",
            keyValue: "unstoppable",
            columns: ["description", "rule"],
            values:
            [
                $"Reach a 7-day streak on any {singular}.",
                $"best-{singular}-streak"
            ]);
    }
}