using LevelHabit.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LevelHabit.Api.Data.Configurations;

public sealed class HabitReminderConfiguration : IEntityTypeConfiguration<HabitReminder>
{
    public void Configure(EntityTypeBuilder<HabitReminder> builder)
    {
        builder.ToTable("habit_reminders");

        builder.HasKey(reminder => reminder.Id);

        builder.Property(reminder => reminder.Id)
            .HasColumnName("id");

        builder.Property(reminder => reminder.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(reminder => reminder.HabitId)
            .HasColumnName("habit_id")
            .IsRequired();

        builder.Property(reminder => reminder.IsEnabled)
            .HasColumnName("is_enabled")
            .IsRequired();

        builder.Property(reminder => reminder.TimeOfDay)
            .HasColumnName("time_of_day")
            .HasColumnType("time without time zone")
            .IsRequired();

        builder.Property(reminder => reminder.TimeZoneId)
            .HasColumnName("time_zone_id")
            .HasMaxLength(HabitReminder.TimeZoneIdMaxLength)
            .IsRequired();

        builder.Property(reminder => reminder.DaysOfWeek)
            .HasColumnName("days_of_week")
            .IsRequired();

        builder.Property(reminder => reminder.LastTriggeredAtUtc)
            .HasColumnName("last_triggered_at_utc");

        builder.Property(reminder => reminder.NextTriggerAtUtc)
            .HasColumnName("next_trigger_at_utc");

        builder.Property(reminder => reminder.CreatedAtUtc)
            .HasColumnName("created_at_utc")
            .IsRequired();

        builder.Property(reminder => reminder.UpdatedAtUtc)
            .HasColumnName("updated_at_utc")
            .IsRequired();

        builder.HasOne(reminder => reminder.User)
            .WithMany(user => user.HabitReminders)
            .HasForeignKey(reminder => reminder.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(reminder => reminder.Habit)
            .WithOne(habit => habit.Reminder)
            .HasForeignKey<HabitReminder>(reminder => reminder.HabitId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(reminder => reminder.HabitId)
            .IsUnique();

        builder.HasIndex(reminder => new
        {
            reminder.IsEnabled,
            reminder.NextTriggerAtUtc
        });
    }
}
