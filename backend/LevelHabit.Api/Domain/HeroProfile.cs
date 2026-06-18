namespace LevelHabit.Api.Domain;

public sealed class HeroProfile
{
    public const int HeroNameMaxLength = 80;

    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    public string HeroName { get; set; } = string.Empty;

    public int Level { get; set; } = 1;

    public int TotalXp { get; set; }

    public int CurrentStreak { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset UpdatedAtUtc { get; set; }

    public User? User { get; set; }
}
