namespace LevelHabit.Api.Services.Reminders;

public interface IReminderScheduleCalculator
{
    DateTimeOffset CalculateNextTriggerUtc(
        TimeOnly timeOfDay,
        string timeZoneId,
        IReadOnlyCollection<DayOfWeek> daysOfWeek,
        DateTimeOffset nowUtc);

    bool TimeZoneExists(string timeZoneId);
}
