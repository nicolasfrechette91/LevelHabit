namespace LevelHabit.Api.Contracts.Quests;

public sealed record QuestCompletionResponse(
    Guid Id,
    Guid QuestId,
    Guid UserId,
    DateOnly CompletionDateUtc,
    DateTimeOffset CompletedAtUtc);
