namespace LevelHabit.Api.Services.Quests;

public sealed record QuestCompletionStreakEntry(
    DateOnly CompletionDateUtc,
    DateTimeOffset CompletedAtUtc);
