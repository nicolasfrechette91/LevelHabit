using System.Globalization;
using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace LevelHabit.Api.Services.Reminders;

public sealed class HabitReminderProcessor(
    LevelHabitDbContext dbContext,
    TimeProvider timeProvider,
    IReminderScheduleCalculator scheduleCalculator,
    ILogger<HabitReminderProcessor> logger) : IHabitReminderProcessor
{
    private const int BatchSize = 50;

    public async Task<int> ProcessDueAsync(CancellationToken cancellationToken)
    {
        DateTimeOffset now = timeProvider.GetUtcNow();

        await using IDbContextTransaction? transaction =
            dbContext.Database.IsRelational()
                ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
                : null;

        List<HabitReminder> dueReminders = await LoadDueRemindersAsync(
            now,
            cancellationToken);
        int createdNotifications = 0;

        foreach (HabitReminder reminder in dueReminders)
        {
            cancellationToken.ThrowIfCancellationRequested();

            DateTimeOffset? scheduledAtUtc = reminder.NextTriggerAtUtc;

            if (scheduledAtUtc is null)
            {
                continue;
            }

            Habit? habit = await dbContext.Habits
                .AsNoTracking()
                .SingleOrDefaultAsync(
                    candidate =>
                        candidate.Id == reminder.HabitId
                        && candidate.UserId == reminder.UserId,
                    cancellationToken);

            if (habit is null || habit.IsArchived)
            {
                DisableReminder(reminder, now);
                continue;
            }

            IReadOnlyList<DayOfWeek> daysOfWeek = ReminderDays.FromBitMask(
                reminder.DaysOfWeek);

            if (daysOfWeek.Count == 0)
            {
                logger.LogWarning(
                    "Disabling reminder {ReminderId} because it has no valid reminder days.",
                    reminder.Id);
                DisableReminder(reminder, now);
                continue;
            }

            string deduplicationKey = CreateDeduplicationKey(
                reminder.Id,
                scheduledAtUtc.Value);
            bool notificationAlreadyExists = await dbContext.Notifications
                .AsNoTracking()
                .AnyAsync(
                    notification =>
                        notification.UserId == reminder.UserId
                        && notification.DeduplicationKey == deduplicationKey,
                    cancellationToken);

            if (!notificationAlreadyExists)
            {
                dbContext.Notifications.Add(new Notification
                {
                    UserId = reminder.UserId,
                    HabitId = habit.Id,
                    Type = NotificationType.HabitReminder,
                    Title = "Habit reminder",
                    Message = $"{habit.Title} is ready.",
                    IsRead = false,
                    CreatedAtUtc = now,
                    ReferenceUrl = $"/habits?habitId={habit.Id}",
                    DeduplicationKey = deduplicationKey
                });
                createdNotifications += 1;
            }

            reminder.LastTriggeredAtUtc = scheduledAtUtc.Value.ToUniversalTime();
            reminder.NextTriggerAtUtc = scheduleCalculator.CalculateNextTriggerUtc(
                reminder.TimeOfDay,
                reminder.TimeZoneId,
                daysOfWeek,
                now);
            reminder.UpdatedAtUtc = now;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        return createdNotifications;
    }

    private async Task<List<HabitReminder>> LoadDueRemindersAsync(
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        if (dbContext.Database.IsRelational())
        {
            return await dbContext.HabitReminders
                .FromSqlInterpolated($"""
                    SELECT *
                    FROM habit_reminders
                    WHERE is_enabled = TRUE
                        AND next_trigger_at_utc IS NOT NULL
                        AND next_trigger_at_utc <= {now}
                    ORDER BY next_trigger_at_utc
                    LIMIT {BatchSize}
                    FOR UPDATE SKIP LOCKED
                    """)
                .ToListAsync(cancellationToken);
        }

        return await dbContext.HabitReminders
            .Where(reminder =>
                reminder.IsEnabled
                && reminder.NextTriggerAtUtc != null
                && reminder.NextTriggerAtUtc <= now)
            .OrderBy(reminder => reminder.NextTriggerAtUtc)
            .Take(BatchSize)
            .ToListAsync(cancellationToken);
    }

    private static void DisableReminder(HabitReminder reminder, DateTimeOffset now)
    {
        reminder.IsEnabled = false;
        reminder.NextTriggerAtUtc = null;
        reminder.UpdatedAtUtc = now;
    }

    private static string CreateDeduplicationKey(Guid reminderId, DateTimeOffset scheduledAtUtc)
    {
        string scheduledTimestamp = scheduledAtUtc
            .ToUniversalTime()
            .ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);

        return $"habit-reminder:{reminderId}:{scheduledTimestamp}";
    }
}
