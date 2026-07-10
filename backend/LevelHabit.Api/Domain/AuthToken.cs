namespace LevelHabit.Api.Domain;

public sealed class AuthToken
{
    public const string PasswordResetPurpose = "password_reset";
    public const string EmailVerificationPurpose = "email_verification";
    public const int PurposeMaxLength = 64;
    public const int TokenHashMaxLength = 64;

    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    public User? User { get; set; }

    public string Purpose { get; set; } = string.Empty;

    public string TokenHash { get; set; } = string.Empty;

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset ExpiresAtUtc { get; set; }

    public DateTimeOffset? UsedAtUtc { get; set; }
}
