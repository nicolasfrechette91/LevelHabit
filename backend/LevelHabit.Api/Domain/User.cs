namespace LevelHabit.Api.Domain;

public sealed class User
{
    public const int EmailMaxLength = 320;
    public const int DisplayNameMaxLength = 80;
    public const int PasswordHashMaxLength = 512;
    public const int EmailVerificationCodeHashMaxLength = 64;

    public Guid Id { get; set; } = Guid.NewGuid();

    public string Email { get; set; } = string.Empty;

    public string NormalizedEmail { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public bool EmailConfirmed { get; set; }

    public DateTimeOffset? EmailConfirmedAtUtc { get; set; }

    public string? EmailVerificationCodeHash { get; set; }

    public DateTimeOffset? EmailVerificationCodeExpiresAtUtc { get; set; }

    public DateTimeOffset? EmailVerificationCodeLastSentAtUtc { get; set; }

    public int EmailVerificationFailedAttempts { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset UpdatedAtUtc { get; set; }

    public ProgressProfile? ProgressProfile { get; set; }

    public ICollection<Habit> Habits { get; set; } = [];

    public ICollection<HabitCompletion> HabitCompletions { get; set; } = [];

    public ICollection<UserAchievement> UserAchievements { get; set; } = [];

    public ICollection<RefreshToken> RefreshTokens { get; set; } = [];

    public ICollection<AuthToken> AuthTokens { get; set; } = [];

    public ICollection<HabitReminder> HabitReminders { get; set; } = [];

    public ICollection<Notification> Notifications { get; set; } = [];
}
