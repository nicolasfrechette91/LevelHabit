namespace LevelHabit.Api.Contracts.Auth;

public sealed record AuthResponse(
    string AccessToken,
    DateTimeOffset ExpiresAtUtc,
    UserResponse User,
    HeroProfileResponse HeroProfile);
