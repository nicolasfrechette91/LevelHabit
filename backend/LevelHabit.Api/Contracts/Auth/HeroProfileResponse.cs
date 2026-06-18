namespace LevelHabit.Api.Contracts.Auth;

public sealed record HeroProfileResponse(
    Guid Id,
    string HeroName,
    int Level,
    int TotalXp,
    int CurrentStreak,
    DateTimeOffset CreatedAtUtc);
