namespace LevelHabit.Api.Contracts.Auth;

public sealed record ProgressProfileResponse(
    Guid Id,
    string DisplayName,
    int Level,
    int TotalXp,
    int XpInCurrentLevel,
    int XpRequiredForNextLevel,
    int XpToNextLevel,
    int CurrentStreak,
    DateTimeOffset CreatedAtUtc);
