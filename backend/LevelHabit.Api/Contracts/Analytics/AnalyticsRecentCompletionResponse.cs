namespace LevelHabit.Api.Contracts.Analytics;

public sealed record AnalyticsRecentCompletionResponse(
    Guid Id,
    Guid QuestId,
    string QuestTitle,
    string Category,
    string Difficulty,
    DateOnly CompletionDateUtc,
    DateTimeOffset CompletedAtUtc,
    int XpAwarded);
