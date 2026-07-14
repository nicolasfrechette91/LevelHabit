namespace LevelHabit.Api.Contracts.Reminders;

public sealed record QuestReminderResponse(
    Guid? Id,
    Guid QuestId,
    bool IsEnabled,
    string? Time,
    string? TimeZoneId,
    IReadOnlyList<string> DaysOfWeek,
    DateTimeOffset? LastTriggeredAtUtc,
    DateTimeOffset? NextTriggerAtUtc,
    DateTimeOffset? CreatedAtUtc,
    DateTimeOffset? UpdatedAtUtc);
