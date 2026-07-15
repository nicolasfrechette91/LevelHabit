using LevelHabit.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LevelHabit.Api.Data.Configurations;

public sealed class HabitConfiguration : IEntityTypeConfiguration<Habit>
{
    public void Configure(EntityTypeBuilder<Habit> builder)
    {
        builder.ToTable("habits");

        builder.HasKey(habit => habit.Id);

        builder.Property(habit => habit.Id)
            .HasColumnName("id");

        builder.Property(habit => habit.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(habit => habit.Title)
            .HasColumnName("title")
            .HasMaxLength(Habit.TitleMaxLength)
            .IsRequired();

        builder.Property(habit => habit.Description)
            .HasColumnName("description")
            .HasMaxLength(Habit.DescriptionMaxLength)
            .IsRequired();

        builder.Property(habit => habit.Category)
            .HasColumnName("category")
            .HasMaxLength(Habit.CategoryMaxLength)
            .IsRequired();

        builder.Property(habit => habit.Difficulty)
            .HasColumnName("difficulty")
            .HasMaxLength(Habit.DifficultyMaxLength)
            .IsRequired();

        builder.Property(habit => habit.Frequency)
            .HasColumnName("frequency")
            .HasMaxLength(Habit.FrequencyMaxLength)
            .IsRequired();

        builder.Property(habit => habit.IsArchived)
            .HasColumnName("is_archived")
            .IsRequired();

        builder.Property(habit => habit.CreatedAtUtc)
            .HasColumnName("created_at_utc")
            .IsRequired();

        builder.Property(habit => habit.UpdatedAtUtc)
            .HasColumnName("updated_at_utc")
            .IsRequired();

        builder.HasOne(habit => habit.User)
            .WithMany(user => user.Habits)
            .HasForeignKey(habit => habit.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(habit => new { habit.UserId, habit.IsArchived });
    }
}
