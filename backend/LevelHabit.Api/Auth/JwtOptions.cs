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
    public int ExpirationMinutes { get; init; } = 60;

    public string? Secret { get; init; }
}
