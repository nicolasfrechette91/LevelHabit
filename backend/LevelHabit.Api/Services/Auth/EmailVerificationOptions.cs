using System.ComponentModel.DataAnnotations;

namespace LevelHabit.Api.Services.Auth;

public sealed class EmailVerificationOptions
{
    public const string SectionName = "EmailVerification";

    [Range(1, 1440)]
    public int CodeExpirationMinutes { get; init; } = 10;

    [Range(0, 3600)]
    public int ResendCooldownSeconds { get; init; } = 60;

    [Range(1, 20)]
    public int MaximumFailedAttempts { get; init; } = 5;
}
