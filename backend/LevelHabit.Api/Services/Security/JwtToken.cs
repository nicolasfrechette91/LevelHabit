namespace LevelHabit.Api.Services.Security;

public sealed record JwtToken(
    string AccessToken,
    DateTimeOffset ExpiresAtUtc);
