namespace LevelHabit.Api.Contracts.Analytics;

public sealed record AnalyticsRecentCompletionResponse(
    Guid Id,
    Guid HabitId,
    string HabitTitle,
    string Category,
    string Difficulty,
    DateOnly CompletionDateUtc,
    DateTimeOffset CompletedAtUtc,
    int XpAwarded);
