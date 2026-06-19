using LevelHabit.Api.Domain;
using LevelHabit.Api.Services.Achievements;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LevelHabit.Api.Data.Configurations;

public sealed class AchievementConfiguration : IEntityTypeConfiguration<Achievement>
{
    public void Configure(EntityTypeBuilder<Achievement> builder)
    {
        builder.ToTable("achievements");

        builder.HasKey(achievement => achievement.Key);

        builder.Property(achievement => achievement.Key)
            .HasColumnName("key")
            .HasMaxLength(Achievement.KeyMaxLength);

        builder.Property(achievement => achievement.Title)
            .HasColumnName("title")
            .HasMaxLength(Achievement.TitleMaxLength)
            .IsRequired();

        builder.Property(achievement => achievement.Description)
            .HasColumnName("description")
            .HasMaxLength(Achievement.DescriptionMaxLength)
            .IsRequired();

        builder.Property(achievement => achievement.Rule)
            .HasColumnName("rule")
            .HasMaxLength(Achievement.RuleMaxLength)
            .IsRequired();

        builder.Property(achievement => achievement.Target)
            .HasColumnName("target")
            .IsRequired();

        builder.Property(achievement => achievement.SortOrder)
            .HasColumnName("sort_order")
            .IsRequired();

        builder.HasIndex(achievement => achievement.SortOrder);

        builder.HasData(AchievementCatalog.All.Select(achievement => new Achievement
        {
            Key = achievement.Key,
            Title = achievement.Title,
            Description = achievement.Description,
            Rule = achievement.Rule,
            Target = achievement.Target,
            SortOrder = achievement.SortOrder
        }));
    }
}
