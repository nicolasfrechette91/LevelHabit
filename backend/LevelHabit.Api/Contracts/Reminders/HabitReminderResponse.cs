namespace LevelHabit.Api.Contracts.Reminders;

public sealed record HabitReminderResponse(
    Guid? Id,
    Guid HabitId,
    bool IsEnabled,
    string? Time,
    string? TimeZoneId,
    IReadOnlyList<string> DaysOfWeek,
    DateTimeOffset? LastTriggeredAtUtc,
    DateTimeOffset? NextTriggerAtUtc,
    DateTimeOffset? CreatedAtUtc,
    DateTimeOffset? UpdatedAtUtc);
