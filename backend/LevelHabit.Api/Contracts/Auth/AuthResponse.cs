namespace LevelHabit.Api.Contracts.Auth;

public sealed record AuthResponse(
    string AccessToken,
    DateTimeOffset ExpiresAtUtc,
    string RefreshToken,
    DateTimeOffset RefreshTokenExpiresAtUtc,
    UserResponse User,
    HeroProfileResponse HeroProfile);
