using LevelHabit.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LevelHabit.Api.Data.Configurations;

public sealed class QuestReminderConfiguration : IEntityTypeConfiguration<QuestReminder>
{
    public void Configure(EntityTypeBuilder<QuestReminder> builder)
    {
        builder.ToTable("quest_reminders");

        builder.HasKey(reminder => reminder.Id);

        builder.Property(reminder => reminder.Id)
            .HasColumnName("id");

        builder.Property(reminder => reminder.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(reminder => reminder.QuestId)
            .HasColumnName("quest_id")
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
            .HasMaxLength(QuestReminder.TimeZoneIdMaxLength)
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
            .WithMany(user => user.QuestReminders)
            .HasForeignKey(reminder => reminder.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(reminder => reminder.Quest)
            .WithOne(quest => quest.Reminder)
            .HasForeignKey<QuestReminder>(reminder => reminder.QuestId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(reminder => reminder.QuestId)
            .IsUnique();

        builder.HasIndex(reminder => new
        {
            reminder.IsEnabled,
            reminder.NextTriggerAtUtc
        });
    }
}
