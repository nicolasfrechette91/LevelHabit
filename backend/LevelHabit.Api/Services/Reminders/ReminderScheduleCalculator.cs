using LevelHabit.Api.Middleware;

namespace LevelHabit.Api.Services.Reminders;

public sealed class ReminderScheduleCalculator : IReminderScheduleCalculator
{
    public DateTimeOffset CalculateNextTriggerUtc(
        TimeOnly timeOfDay,
        string timeZoneId,
        IReadOnlyCollection<DayOfWeek> daysOfWeek,
        DateTimeOffset nowUtc)
    {
        if (daysOfWeek.Count == 0)
        {
            throw new ApiValidationException(new Dictionary<string, string[]>
            {
                [nameof(daysOfWeek)] = ["At least one reminder day is required."]
            });
        }

        TimeZoneInfo timeZone = ResolveTimeZone(timeZoneId);
        HashSet<DayOfWeek> selectedDays = new(daysOfWeek);
        DateTimeOffset localNow = TimeZoneInfo.ConvertTime(
            nowUtc.ToUniversalTime(),
            timeZone);
        DateTime localDate = localNow.Date;

        for (int dayOffset = 0; dayOffset <= 14; dayOffset += 1)
        {
            DateTime candidateDate = localDate.AddDays(dayOffset);

            if (!selectedDays.Contains(candidateDate.DayOfWeek))
            {
                continue;
            }

            DateTime candidateLocal = candidateDate.Add(timeOfDay.ToTimeSpan());
            DateTimeOffset candidateUtc = ConvertLocalToUtc(candidateLocal, timeZone);

            if (candidateUtc > nowUtc.ToUniversalTime())
            {
                return candidateUtc;
            }
        }

        throw new InvalidOperationException("No future reminder occurrence could be calculated.");
    }

    public bool TimeZoneExists(string timeZoneId)
    {
        try
        {
            _ = ResolveTimeZone(timeZoneId);

            return true;
        }
        catch (TimeZoneNotFoundException)
        {
            return false;
        }
        catch (InvalidTimeZoneException)
        {
            return false;
        }
    }

    private static DateTimeOffset ConvertLocalToUtc(
        DateTime localDateTime,
        TimeZoneInfo timeZone)
    {
        DateTime adjustedLocal = DateTime.SpecifyKind(localDateTime, DateTimeKind.Unspecified);

        while (timeZone.IsInvalidTime(adjustedLocal))
        {
            adjustedLocal = adjustedLocal.AddMinutes(1);
        }

        TimeSpan offset = timeZone.IsAmbiguousTime(adjustedLocal)
            ? timeZone.GetAmbiguousTimeOffsets(adjustedLocal).Min()
            : timeZone.GetUtcOffset(adjustedLocal);

        return new DateTimeOffset(adjustedLocal, offset).ToUniversalTime();
    }

    private static TimeZoneInfo ResolveTimeZone(string timeZoneId)
    {
        if (!LooksLikeIanaTimeZoneId(timeZoneId))
        {
            throw new TimeZoneNotFoundException(
                $"Timezone '{timeZoneId}' is not a supported IANA timezone identifier.");
        }

        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        }
        catch (TimeZoneNotFoundException) when (
            TimeZoneInfo.TryConvertIanaIdToWindowsId(timeZoneId, out string? windowsId))
        {
            return TimeZoneInfo.FindSystemTimeZoneById(windowsId);
        }
    }

    private static bool LooksLikeIanaTimeZoneId(string timeZoneId)
    {
        if (string.IsNullOrWhiteSpace(timeZoneId))
        {
            return false;
        }

        string trimmed = timeZoneId.Trim();

        if (string.Equals(trimmed, "UTC", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return trimmed.Contains('/', StringComparison.Ordinal)
            && TimeZoneInfo.TryConvertIanaIdToWindowsId(trimmed, out _);
    }
}
