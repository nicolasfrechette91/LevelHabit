using LevelHabit.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LevelHabit.Api.Data.Configurations;

public sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("notifications");

        builder.HasKey(notification => notification.Id);

        builder.Property(notification => notification.Id)
            .HasColumnName("id");

        builder.Property(notification => notification.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(notification => notification.HabitId)
            .HasColumnName("habit_id");

        builder.Property(notification => notification.Type)
            .HasColumnName("type")
            .HasConversion<string>()
            .HasMaxLength(Notification.TypeMaxLength)
            .IsRequired();

        builder.Property(notification => notification.Title)
            .HasColumnName("title")
            .HasMaxLength(Notification.TitleMaxLength)
            .IsRequired();

        builder.Property(notification => notification.Message)
            .HasColumnName("message")
            .HasMaxLength(Notification.MessageMaxLength)
            .IsRequired();

        builder.Property(notification => notification.IsRead)
            .HasColumnName("is_read")
            .IsRequired();

        builder.Property(notification => notification.CreatedAtUtc)
            .HasColumnName("created_at_utc")
            .IsRequired();

        builder.Property(notification => notification.ReadAtUtc)
            .HasColumnName("read_at_utc");

        builder.Property(notification => notification.ReferenceUrl)
            .HasColumnName("reference_url")
            .HasMaxLength(Notification.ReferenceUrlMaxLength);

        builder.Property(notification => notification.DeduplicationKey)
            .HasColumnName("deduplication_key")
            .HasMaxLength(Notification.DeduplicationKeyMaxLength);

        builder.HasOne(notification => notification.User)
            .WithMany(user => user.Notifications)
            .HasForeignKey(notification => notification.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(notification => notification.Habit)
            .WithMany(habit => habit.Notifications)
            .HasForeignKey(notification => notification.HabitId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(notification => new
        {
            notification.UserId,
            notification.IsRead,
            notification.CreatedAtUtc
        });

        builder.HasIndex(notification => new
        {
            notification.UserId,
            notification.DeduplicationKey
        })
            .IsUnique()
            .HasFilter("deduplication_key IS NOT NULL");
    }
}
