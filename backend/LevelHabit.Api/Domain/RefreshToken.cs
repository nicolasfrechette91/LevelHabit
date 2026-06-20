namespace LevelHabit.Api.Domain;

public sealed class RefreshToken
{
    public const int TokenHashMaxLength = 64;
    public const int RevokedReasonMaxLength = 160;

    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    public string TokenHash { get; set; } = string.Empty;

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset ExpiresAtUtc { get; set; }

    public DateTimeOffset? RevokedAtUtc { get; set; }

    public string? ReplacedByTokenHash { get; set; }

    public string? RevokedReason { get; set; }

    public User? User { get; set; }
}
