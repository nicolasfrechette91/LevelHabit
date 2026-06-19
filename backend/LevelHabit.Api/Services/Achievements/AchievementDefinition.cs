namespace LevelHabit.Api.Services.Achievements;

public sealed record AchievementDefinition(
    string Key,
    string Title,
    string Description,
    string Rule,
    int Target,
    int SortOrder);
