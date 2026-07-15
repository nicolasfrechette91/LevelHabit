using LevelHabit.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LevelHabit.Api.Data.Configurations;

public sealed class HabitCompletionConfiguration : IEntityTypeConfiguration<HabitCompletion>
{
    public void Configure(EntityTypeBuilder<HabitCompletion> builder)
    {
        builder.ToTable("habit_completions");

        builder.HasKey(completion => completion.Id);

        builder.Property(completion => completion.Id)
            .HasColumnName("id");

        builder.Property(completion => completion.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(completion => completion.HabitId)
            .HasColumnName("habit_id")
            .IsRequired();

        builder.Property(completion => completion.CompletionDateUtc)
            .HasColumnName("completion_date_utc")
            .IsRequired();

        builder.Property(completion => completion.CompletedAtUtc)
            .HasColumnName("completed_at_utc")
            .IsRequired();

        builder.Property(completion => completion.XpAwarded)
            .HasColumnName("xp_awarded")
            .IsRequired();

        builder.HasOne(completion => completion.User)
            .WithMany(user => user.HabitCompletions)
            .HasForeignKey(completion => completion.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(completion => completion.Habit)
            .WithMany(habit => habit.Completions)
            .HasForeignKey(completion => completion.HabitId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(completion => new
            {
                completion.UserId,
                completion.HabitId,
                completion.CompletionDateUtc
            })
            .IsUnique();
    }
}
