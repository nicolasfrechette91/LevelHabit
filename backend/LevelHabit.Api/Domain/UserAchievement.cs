namespace LevelHabit.Api.Domain;

public sealed class UserAchievement
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    public string AchievementKey { get; set; } = string.Empty;

    public DateTimeOffset UnlockedAtUtc { get; set; }

    public User? User { get; set; }

    public Achievement? Achievement { get; set; }
}
