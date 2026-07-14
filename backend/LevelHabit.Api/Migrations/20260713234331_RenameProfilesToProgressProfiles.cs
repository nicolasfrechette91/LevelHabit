using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LevelHabit.Api.Migrations
{
    /// <inheritdoc />
    public partial class RenameProfilesToProgressProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_hero_profiles_users_user_id",
                table: "hero_profiles");

            migrationBuilder.DropForeignKey(
                name: "FK_user_achievements_achievements_achievement_key",
                table: "user_achievements");

            migrationBuilder.DropPrimaryKey(
                name: "PK_hero_profiles",
                table: "hero_profiles");

            migrationBuilder.RenameTable(
                name: "hero_profiles",
                newName: "progress_profiles");

            migrationBuilder.RenameColumn(
                name: "hero_name",
                table: "progress_profiles",
                newName: "display_name");

            migrationBuilder.RenameIndex(
                name: "IX_hero_profiles_user_id",
                table: "progress_profiles",
                newName: "IX_progress_profiles_user_id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_progress_profiles",
                table: "progress_profiles",
                column: "id");

            migrationBuilder.Sql(
                """
                UPDATE achievements
                SET description = 'Reach level 2.'
                WHERE key = 'level-up';

                UPDATE user_achievements
                SET achievement_key = 'progress-rising'
                WHERE achievement_key = 'hero-rising';

                UPDATE achievements
                SET
                    key = 'progress-rising',
                    title = 'Progress Rising',
                    description = 'Reach level 5.'
                WHERE key = 'hero-rising';

                UPDATE user_achievements
                SET achievement_key = 'balanced-progress'
                WHERE achievement_key = 'balanced-hero';

                UPDATE achievements
                SET
                    key = 'balanced-progress',
                    title = 'Balanced Progress'
                WHERE key = 'balanced-hero';
                """);

            migrationBuilder.AddForeignKey(
                name: "FK_progress_profiles_users_user_id",
                table: "progress_profiles",
                column: "user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_user_achievements_achievements_achievement_key",
                table: "user_achievements",
                column: "achievement_key",
                principalTable: "achievements",
                principalColumn: "key",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_progress_profiles_users_user_id",
                table: "progress_profiles");

            migrationBuilder.DropForeignKey(
                name: "FK_user_achievements_achievements_achievement_key",
                table: "user_achievements");

            migrationBuilder.DropPrimaryKey(
                name: "PK_progress_profiles",
                table: "progress_profiles");

            migrationBuilder.RenameTable(
                name: "progress_profiles",
                newName: "hero_profiles");

            migrationBuilder.RenameColumn(
                name: "display_name",
                table: "hero_profiles",
                newName: "hero_name");

            migrationBuilder.RenameIndex(
                name: "IX_progress_profiles_user_id",
                table: "hero_profiles",
                newName: "IX_hero_profiles_user_id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_hero_profiles",
                table: "hero_profiles",
                column: "id");

            migrationBuilder.Sql(
                """
                UPDATE achievements
                SET description = 'Reach hero level 2.'
                WHERE key = 'level-up';

                UPDATE user_achievements
                SET achievement_key = 'hero-rising'
                WHERE achievement_key = 'progress-rising';

                UPDATE achievements
                SET
                    key = 'hero-rising',
                    title = 'Hero Rising',
                    description = 'Reach hero level 5.'
                WHERE key = 'progress-rising';

                UPDATE user_achievements
                SET achievement_key = 'balanced-hero'
                WHERE achievement_key = 'balanced-progress';

                UPDATE achievements
                SET
                    key = 'balanced-hero',
                    title = 'Balanced Hero'
                WHERE key = 'balanced-progress';
                """);

            migrationBuilder.AddForeignKey(
                name: "FK_hero_profiles_users_user_id",
                table: "hero_profiles",
                column: "user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_user_achievements_achievements_achievement_key",
                table: "user_achievements",
                column: "achievement_key",
                principalTable: "achievements",
                principalColumn: "key",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
