using System.Globalization;
using System.Security.Claims;
using LevelHabit.Api.Contracts.Reminders;
using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using LevelHabit.Api.Middleware;
using LevelHabit.Api.Services.Security;
using Microsoft.EntityFrameworkCore;

namespace LevelHabit.Api.Services.Reminders;

public sealed class QuestReminderService(
    LevelHabitDbContext dbContext,
    TimeProvider timeProvider,
    IReminderScheduleCalculator scheduleCalculator) : IQuestReminderService
{
    private const string TimeFormat = "HH:mm";

    public async Task<QuestReminderResponse> GetAsync(
        ClaimsPrincipal principal,
        Guid questId,
        CancellationToken cancellationToken)
    {
        Guid userId = AuthenticatedUser.GetUserId(principal);
        Quest quest = await FindOwnedQuestAsync(userId, questId, cancellationToken);
        QuestReminder? reminder = await dbContext.QuestReminders
            .AsNoTracking()
            .SingleOrDefaultAsync(
                candidate => candidate.UserId == userId && candidate.QuestId == quest.Id,
                cancellationToken);

        return reminder is null
            ? EmptyResponse(quest.Id)
            : MapReminder(reminder);
    }

    public async Task<QuestReminderResponse> UpsertAsync(
        ClaimsPrincipal principal,
        Guid questId,
        UpsertQuestReminderRequest request,
        CancellationToken cancellationToken)
    {
        Guid userId = AuthenticatedUser.GetUserId(principal);
        Quest quest = await FindOwnedQuestAsync(userId, questId, cancellationToken);

        if (request.IsEnabled && quest.IsArchived)
        {
            throw new ApiValidationException(new Dictionary<string, string[]>
            {
                [nameof(UpsertQuestReminderRequest.IsEnabled)] =
                [
                    "Archived quests cannot have enabled reminders."
                ]
            });
        }

        QuestReminder? reminder = await dbContext.QuestReminders
            .SingleOrDefaultAsync(
                candidate => candidate.UserId == userId && candidate.QuestId == quest.Id,
                cancellationToken);
        CleanReminderInput input = CleanAndValidate(request, reminder);
        DateTimeOffset now = timeProvider.GetUtcNow();
        DateTimeOffset? nextTriggerAtUtc = request.IsEnabled
            ? scheduleCalculator.CalculateNextTriggerUtc(
                input.TimeOfDay,
                input.TimeZoneId,
                ReminderDays.FromBitMask(input.DaysOfWeek),
                now)
            : null;

        if (reminder is null)
        {
            reminder = new QuestReminder
            {
                UserId = userId,
                QuestId = quest.Id,
                CreatedAtUtc = now
            };

            dbContext.QuestReminders.Add(reminder);
        }

        reminder.IsEnabled = request.IsEnabled;
        reminder.TimeOfDay = input.TimeOfDay;
        reminder.TimeZoneId = input.TimeZoneId;
        reminder.DaysOfWeek = input.DaysOfWeek;
        reminder.NextTriggerAtUtc = nextTriggerAtUtc;
        reminder.UpdatedAtUtc = now;

        await dbContext.SaveChangesAsync(cancellationToken);

        return MapReminder(reminder);
    }

    public async Task DeleteAsync(
        ClaimsPrincipal principal,
        Guid questId,
        CancellationToken cancellationToken)
    {
        Guid userId = AuthenticatedUser.GetUserId(principal);
        Quest quest = await FindOwnedQuestAsync(userId, questId, cancellationToken);
        QuestReminder? reminder = await dbContext.QuestReminders
            .SingleOrDefaultAsync(
                candidate => candidate.UserId == userId && candidate.QuestId == quest.Id,
                cancellationToken);

        if (reminder is null)
        {
            return;
        }

        dbContext.QuestReminders.Remove(reminder);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private CleanReminderInput CleanAndValidate(
        UpsertQuestReminderRequest request,
        QuestReminder? existingReminder)
    {
        Dictionary<string, string[]> errors = [];
        TimeOnly timeOfDay = existingReminder?.TimeOfDay ?? TimeOnly.MinValue;
        string timeZoneId = existingReminder?.TimeZoneId ?? "UTC";
        int daysOfWeek = existingReminder?.DaysOfWeek ?? 0;

        if (request.IsEnabled && string.IsNullOrWhiteSpace(request.Time))
        {
            errors[nameof(UpsertQuestReminderRequest.Time)] =
            [
                "Reminder time is required when reminders are enabled."
            ];
        }
        else if (!string.IsNullOrWhiteSpace(request.Time))
        {
            if (TimeOnly.TryParseExact(
                request.Time.Trim(),
                TimeFormat,
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out TimeOnly parsedTime))
            {
                timeOfDay = parsedTime;
            }
            else
            {
                errors[nameof(UpsertQuestReminderRequest.Time)] =
                [
                    "Reminder time must use HH:mm format."
                ];
            }
        }

        if (request.IsEnabled && string.IsNullOrWhiteSpace(request.TimeZoneId))
        {
            errors[nameof(UpsertQuestReminderRequest.TimeZoneId)] =
            [
                "Reminder timezone is required when reminders are enabled."
            ];
        }
        else if (!string.IsNullOrWhiteSpace(request.TimeZoneId))
        {
            string trimmedTimeZoneId = request.TimeZoneId.Trim();

            if (trimmedTimeZoneId.Length > QuestReminder.TimeZoneIdMaxLength)
            {
                errors[nameof(UpsertQuestReminderRequest.TimeZoneId)] =
                [
                    $"Reminder timezone must be {QuestReminder.TimeZoneIdMaxLength} characters or fewer."
                ];
            }
            else if (!scheduleCalculator.TimeZoneExists(trimmedTimeZoneId))
            {
                errors[nameof(UpsertQuestReminderRequest.TimeZoneId)] =
                [
                    "Reminder timezone must be a valid IANA timezone identifier."
                ];
            }
            else
            {
                timeZoneId = trimmedTimeZoneId;
            }
        }

        if (request.DaysOfWeek is not null)
        {
            daysOfWeek = ParseDaysOfWeek(request.DaysOfWeek, errors);
        }

        if (request.IsEnabled && daysOfWeek == 0)
        {
            errors[nameof(UpsertQuestReminderRequest.DaysOfWeek)] =
            [
                "Select at least one reminder day when reminders are enabled."
            ];
        }

        if (errors.Count > 0)
        {
            throw new ApiValidationException(errors);
        }

        return new CleanReminderInput(timeOfDay, timeZoneId, daysOfWeek);
    }

    private static int ParseDaysOfWeek(
        IReadOnlyCollection<string> values,
        Dictionary<string, string[]> errors)
    {
        List<DayOfWeek> daysOfWeek = [];
        List<string> invalidValues = [];

        foreach (string value in values)
        {
            string cleaned = value.Trim();

            if (
                cleaned.Length == 0
                || cleaned.All(char.IsDigit)
                || !Enum.TryParse(cleaned, ignoreCase: true, out DayOfWeek dayOfWeek)
                || !Enum.GetNames<DayOfWeek>().Contains(
                    dayOfWeek.ToString(),
                    StringComparer.Ordinal))
            {
                invalidValues.Add(value);
                continue;
            }

            daysOfWeek.Add(dayOfWeek);
        }

        if (invalidValues.Count > 0)
        {
            errors[nameof(UpsertQuestReminderRequest.DaysOfWeek)] =
            [
                "Reminder days must use weekday names such as Monday or Friday."
            ];

            return 0;
        }

        return ReminderDays.ToBitMask(daysOfWeek);
    }

    private async Task<Quest> FindOwnedQuestAsync(
        Guid userId,
        Guid questId,
        CancellationToken cancellationToken)
    {
        Quest? quest = await dbContext.Quests
            .SingleOrDefaultAsync(
                candidate => candidate.Id == questId && candidate.UserId == userId,
                cancellationToken);

        return quest ?? throw QuestNotFound();
    }

    private static QuestReminderResponse EmptyResponse(Guid questId)
    {
        return new QuestReminderResponse(
            Id: null,
            QuestId: questId,
            IsEnabled: false,
            Time: null,
            TimeZoneId: null,
            DaysOfWeek: [],
            LastTriggeredAtUtc: null,
            NextTriggerAtUtc: null,
            CreatedAtUtc: null,
            UpdatedAtUtc: null);
    }

    private static QuestReminderResponse MapReminder(QuestReminder reminder)
    {
        return new QuestReminderResponse(
            Id: reminder.Id,
            QuestId: reminder.QuestId,
            IsEnabled: reminder.IsEnabled,
            Time: reminder.TimeOfDay.ToString(TimeFormat, CultureInfo.InvariantCulture),
            TimeZoneId: reminder.TimeZoneId,
            DaysOfWeek: ReminderDays.NamesFromBitMask(reminder.DaysOfWeek),
            LastTriggeredAtUtc: reminder.LastTriggeredAtUtc,
            NextTriggerAtUtc: reminder.NextTriggerAtUtc,
            CreatedAtUtc: reminder.CreatedAtUtc,
            UpdatedAtUtc: reminder.UpdatedAtUtc);
    }

    private static ApiException QuestNotFound()
    {
        return new ApiException(
            StatusCodes.Status404NotFound,
            "Quest not found",
            "The requested quest could not be found.");
    }

    private sealed record CleanReminderInput(
        TimeOnly TimeOfDay,
        string TimeZoneId,
        int DaysOfWeek);
}
