using System.Globalization;
using System.Security.Claims;
using LevelHabit.Api.Contracts.Reminders;
using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using LevelHabit.Api.Middleware;
using LevelHabit.Api.Services.Security;
using Microsoft.EntityFrameworkCore;

namespace LevelHabit.Api.Services.Reminders;

public sealed class HabitReminderService(
    LevelHabitDbContext dbContext,
    TimeProvider timeProvider,
    IReminderScheduleCalculator scheduleCalculator) : IHabitReminderService
{
    private const string TimeFormat = "HH:mm";

    public async Task<HabitReminderResponse> GetAsync(
        ClaimsPrincipal principal,
        Guid habitId,
        CancellationToken cancellationToken)
    {
        Guid userId = AuthenticatedUser.GetUserId(principal);
        Habit habit = await FindOwnedHabitAsync(userId, habitId, cancellationToken);
        HabitReminder? reminder = await dbContext.HabitReminders
            .AsNoTracking()
            .SingleOrDefaultAsync(
                candidate => candidate.UserId == userId && candidate.HabitId == habit.Id,
                cancellationToken);

        return reminder is null
            ? EmptyResponse(habit.Id)
            : MapReminder(reminder);
    }

    public async Task<HabitReminderResponse> UpsertAsync(
        ClaimsPrincipal principal,
        Guid habitId,
        UpsertHabitReminderRequest request,
        CancellationToken cancellationToken)
    {
        Guid userId = AuthenticatedUser.GetUserId(principal);
        Habit habit = await FindOwnedHabitAsync(userId, habitId, cancellationToken);

        if (request.IsEnabled && habit.IsArchived)
        {
            throw new ApiValidationException(new Dictionary<string, string[]>
            {
                [nameof(UpsertHabitReminderRequest.IsEnabled)] =
                [
                    "Archived habits cannot have enabled reminders."
                ]
            });
        }

        HabitReminder? reminder = await dbContext.HabitReminders
            .SingleOrDefaultAsync(
                candidate => candidate.UserId == userId && candidate.HabitId == habit.Id,
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
            reminder = new HabitReminder
            {
                UserId = userId,
                HabitId = habit.Id,
                CreatedAtUtc = now
            };

            dbContext.HabitReminders.Add(reminder);
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
        Guid habitId,
        CancellationToken cancellationToken)
    {
        Guid userId = AuthenticatedUser.GetUserId(principal);
        Habit habit = await FindOwnedHabitAsync(userId, habitId, cancellationToken);
        HabitReminder? reminder = await dbContext.HabitReminders
            .SingleOrDefaultAsync(
                candidate => candidate.UserId == userId && candidate.HabitId == habit.Id,
                cancellationToken);

        if (reminder is null)
        {
            return;
        }

        dbContext.HabitReminders.Remove(reminder);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private CleanReminderInput CleanAndValidate(
        UpsertHabitReminderRequest request,
        HabitReminder? existingReminder)
    {
        Dictionary<string, string[]> errors = [];
        TimeOnly timeOfDay = existingReminder?.TimeOfDay ?? TimeOnly.MinValue;
        string timeZoneId = existingReminder?.TimeZoneId ?? "UTC";
        int daysOfWeek = existingReminder?.DaysOfWeek ?? 0;

        if (request.IsEnabled && string.IsNullOrWhiteSpace(request.Time))
        {
            errors[nameof(UpsertHabitReminderRequest.Time)] =
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
                errors[nameof(UpsertHabitReminderRequest.Time)] =
                [
                    "Reminder time must use HH:mm format."
                ];
            }
        }

        if (request.IsEnabled && string.IsNullOrWhiteSpace(request.TimeZoneId))
        {
            errors[nameof(UpsertHabitReminderRequest.TimeZoneId)] =
            [
                "Reminder timezone is required when reminders are enabled."
            ];
        }
        else if (!string.IsNullOrWhiteSpace(request.TimeZoneId))
        {
            string trimmedTimeZoneId = request.TimeZoneId.Trim();

            if (trimmedTimeZoneId.Length > HabitReminder.TimeZoneIdMaxLength)
            {
                errors[nameof(UpsertHabitReminderRequest.TimeZoneId)] =
                [
                    $"Reminder timezone must be {HabitReminder.TimeZoneIdMaxLength} characters or fewer."
                ];
            }
            else if (!scheduleCalculator.TimeZoneExists(trimmedTimeZoneId))
            {
                errors[nameof(UpsertHabitReminderRequest.TimeZoneId)] =
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
            errors[nameof(UpsertHabitReminderRequest.DaysOfWeek)] =
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
            errors[nameof(UpsertHabitReminderRequest.DaysOfWeek)] =
            [
                "Reminder days must use weekday names such as Monday or Friday."
            ];

            return 0;
        }

        return ReminderDays.ToBitMask(daysOfWeek);
    }

    private async Task<Habit> FindOwnedHabitAsync(
        Guid userId,
        Guid habitId,
        CancellationToken cancellationToken)
    {
        Habit? habit = await dbContext.Habits
            .SingleOrDefaultAsync(
                candidate => candidate.Id == habitId && candidate.UserId == userId,
                cancellationToken);

        return habit ?? throw HabitNotFound();
    }

    private static HabitReminderResponse EmptyResponse(Guid habitId)
    {
        return new HabitReminderResponse(
            Id: null,
            HabitId: habitId,
            IsEnabled: false,
            Time: null,
            TimeZoneId: null,
            DaysOfWeek: [],
            LastTriggeredAtUtc: null,
            NextTriggerAtUtc: null,
            CreatedAtUtc: null,
            UpdatedAtUtc: null);
    }

    private static HabitReminderResponse MapReminder(HabitReminder reminder)
    {
        return new HabitReminderResponse(
            Id: reminder.Id,
            HabitId: reminder.HabitId,
            IsEnabled: reminder.IsEnabled,
            Time: reminder.TimeOfDay.ToString(TimeFormat, CultureInfo.InvariantCulture),
            TimeZoneId: reminder.TimeZoneId,
            DaysOfWeek: ReminderDays.NamesFromBitMask(reminder.DaysOfWeek),
            LastTriggeredAtUtc: reminder.LastTriggeredAtUtc,
            NextTriggerAtUtc: reminder.NextTriggerAtUtc,
            CreatedAtUtc: reminder.CreatedAtUtc,
            UpdatedAtUtc: reminder.UpdatedAtUtc);
    }

    private static ApiException HabitNotFound()
    {
        return new ApiException(
            StatusCodes.Status404NotFound,
            "Habit not found",
            "The requested habit could not be found.");
    }

    private sealed record CleanReminderInput(
        TimeOnly TimeOfDay,
        string TimeZoneId,
        int DaysOfWeek);
}
