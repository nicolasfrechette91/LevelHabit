namespace LevelHabit.Api.Contracts.Reminders;

public sealed record UpsertHabitReminderRequest(
    bool IsEnabled,
    string? Time,
    string? TimeZoneId,
    IReadOnlyList<string>? DaysOfWeek);
