namespace LevelHabit.Api.Contracts.Achievements;

public sealed record AchievementResponse(
    string Key,
    string Title,
    string Description,
    string Rule,
    bool IsUnlocked,
    DateTimeOffset? UnlockedAtUtc,
    int Progress,
    int Target,
    string ProgressText);
