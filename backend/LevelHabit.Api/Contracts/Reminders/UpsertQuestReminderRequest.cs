namespace LevelHabit.Api.Contracts.Reminders;

public sealed record UpsertQuestReminderRequest(
    bool IsEnabled,
    string? Time,
    string? TimeZoneId,
    IReadOnlyList<string>? DaysOfWeek);
