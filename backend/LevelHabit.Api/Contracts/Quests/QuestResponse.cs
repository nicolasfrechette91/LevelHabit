namespace LevelHabit.Api.Contracts.Quests;

public sealed record QuestResponse(
    Guid Id,
    Guid UserId,
    string Title,
    string Description,
    string Category,
    string Difficulty,
    string Frequency,
    bool IsArchived,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);
