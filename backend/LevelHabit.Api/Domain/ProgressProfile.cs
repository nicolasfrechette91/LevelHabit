namespace LevelHabit.Api.Domain;

public sealed class ProgressProfile
{
    public const int DisplayNameMaxLength = 80;

    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    public string DisplayName { get; set; } = string.Empty;

    public int Level { get; set; } = 1;

    public int TotalXp { get; set; }

    public int CurrentStreak { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset UpdatedAtUtc { get; set; }

    public User? User { get; set; }
}
