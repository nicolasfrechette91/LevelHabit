namespace LevelHabit.Api.Domain;

public sealed class User
{
    public const int EmailMaxLength = 320;
    public const int DisplayNameMaxLength = 80;
    public const int PasswordHashMaxLength = 512;

    public Guid Id { get; set; } = Guid.NewGuid();

    public string Email { get; set; } = string.Empty;

    public string NormalizedEmail { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset UpdatedAtUtc { get; set; }

    public HeroProfile? HeroProfile { get; set; }

    public ICollection<Quest> Quests { get; set; } = [];

    public ICollection<QuestCompletion> QuestCompletions { get; set; } = [];

    public ICollection<UserAchievement> UserAchievements { get; set; } = [];
}
