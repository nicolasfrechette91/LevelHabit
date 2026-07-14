using System.Globalization;
using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace LevelHabit.Api.Services.Reminders;

public sealed class QuestReminderProcessor(
    LevelHabitDbContext dbContext,
    TimeProvider timeProvider,
    IReminderScheduleCalculator scheduleCalculator,
    ILogger<QuestReminderProcessor> logger) : IQuestReminderProcessor
{
    private const int BatchSize = 50;

    public async Task<int> ProcessDueAsync(CancellationToken cancellationToken)
    {
        DateTimeOffset now = timeProvider.GetUtcNow();

        await using IDbContextTransaction? transaction =
            dbContext.Database.IsRelational()
                ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
                : null;

        List<QuestReminder> dueReminders = await LoadDueRemindersAsync(
            now,
            cancellationToken);
        int createdNotifications = 0;

        foreach (QuestReminder reminder in dueReminders)
        {
            cancellationToken.ThrowIfCancellationRequested();

            DateTimeOffset? scheduledAtUtc = reminder.NextTriggerAtUtc;

            if (scheduledAtUtc is null)
            {
                continue;
            }

            Quest? quest = await dbContext.Quests
                .AsNoTracking()
                .SingleOrDefaultAsync(
                    candidate =>
                        candidate.Id == reminder.QuestId
                        && candidate.UserId == reminder.UserId,
                    cancellationToken);

            if (quest is null || quest.IsArchived)
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
                    QuestId = quest.Id,
                    Type = NotificationType.QuestReminder,
                    Title = "Quest reminder",
                    Message = $"{quest.Title} is ready.",
                    IsRead = false,
                    CreatedAtUtc = now,
                    ReferenceUrl = $"/quests?questId={quest.Id}",
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

    private async Task<List<QuestReminder>> LoadDueRemindersAsync(
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        if (dbContext.Database.IsRelational())
        {
            return await dbContext.QuestReminders
                .FromSqlInterpolated($"""
                    SELECT *
                    FROM quest_reminders
                    WHERE is_enabled = TRUE
                        AND next_trigger_at_utc IS NOT NULL
                        AND next_trigger_at_utc <= {now}
                    ORDER BY next_trigger_at_utc
                    LIMIT {BatchSize}
                    FOR UPDATE SKIP LOCKED
                    """)
                .ToListAsync(cancellationToken);
        }

        return await dbContext.QuestReminders
            .Where(reminder =>
                reminder.IsEnabled
                && reminder.NextTriggerAtUtc != null
                && reminder.NextTriggerAtUtc <= now)
            .OrderBy(reminder => reminder.NextTriggerAtUtc)
            .Take(BatchSize)
            .ToListAsync(cancellationToken);
    }

    private static void DisableReminder(QuestReminder reminder, DateTimeOffset now)
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

        return $"quest-reminder:{reminderId}:{scheduledTimestamp}";
    }
}
