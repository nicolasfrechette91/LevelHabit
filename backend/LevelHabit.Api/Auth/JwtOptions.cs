using System.ComponentModel.DataAnnotations;

namespace LevelHabit.Api.Auth;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    [Required]
    public string Issuer { get; init; } = "LevelHabit.Api";

    [Required]
    public string Audience { get; init; } = "LevelHabit.Frontend";

    [Range(5, 1440)]
    public int ExpirationMinutes { get; init; } = 15;

    [Range(1, 365)]
    public int RefreshTokenExpirationDays { get; init; } = 30;

    public string? Secret { get; init; }
}
