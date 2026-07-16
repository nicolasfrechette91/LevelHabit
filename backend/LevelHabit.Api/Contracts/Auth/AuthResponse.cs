using System.Text.Json.Serialization;

namespace LevelHabit.Api.Contracts.Auth;

public sealed record AuthResponse(
    string AccessToken,
    DateTimeOffset ExpiresAtUtc,
    [property: JsonIgnore]
    string RefreshToken,
    [property: JsonIgnore]
    DateTimeOffset RefreshTokenExpiresAtUtc,
    UserResponse User,
    ProgressProfileResponse ProgressProfile);
