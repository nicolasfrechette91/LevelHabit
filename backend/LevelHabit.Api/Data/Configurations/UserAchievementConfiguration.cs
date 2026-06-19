using LevelHabit.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LevelHabit.Api.Data.Configurations;

public sealed class UserAchievementConfiguration : IEntityTypeConfiguration<UserAchievement>
{
    public void Configure(EntityTypeBuilder<UserAchievement> builder)
    {
        builder.ToTable("user_achievements");

        builder.HasKey(userAchievement => userAchievement.Id);

        builder.Property(userAchievement => userAchievement.Id)
            .HasColumnName("id");

        builder.Property(userAchievement => userAchievement.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(userAchievement => userAchievement.AchievementKey)
            .HasColumnName("achievement_key")
            .HasMaxLength(Achievement.KeyMaxLength)
            .IsRequired();

        builder.Property(userAchievement => userAchievement.UnlockedAtUtc)
            .HasColumnName("unlocked_at_utc")
            .IsRequired();

        builder.HasOne(userAchievement => userAchievement.User)
            .WithMany(user => user.UserAchievements)
            .HasForeignKey(userAchievement => userAchievement.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(userAchievement => userAchievement.Achievement)
            .WithMany(achievement => achievement.UserAchievements)
            .HasForeignKey(userAchievement => userAchievement.AchievementKey)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(userAchievement => new
            {
                userAchievement.UserId,
                userAchievement.AchievementKey
            })
            .IsUnique();
    }
}
