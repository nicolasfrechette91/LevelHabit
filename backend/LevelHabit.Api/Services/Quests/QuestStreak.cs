namespace LevelHabit.Api.Services.Quests;

public sealed record QuestStreak(
    int CurrentStreak,
    int BestStreak,
    DateOnly? LastCompletedDateUtc,
    DateTimeOffset? LastCompletedAtUtc);
