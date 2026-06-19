namespace LevelHabit.Api.Contracts.Quests;

public sealed record QuestResponse(
    Guid Id,
    Guid UserId,
    string Title,
    string Description,
    string Category,
    string Difficulty,
    string Frequency,
    int XpReward,
    bool IsArchived,
    bool CompletedToday,
    int? CompletedTodayXpAwarded,
    DateTimeOffset? CompletedTodayAtUtc,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);
