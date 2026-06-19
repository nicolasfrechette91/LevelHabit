namespace LevelHabit.Api.Domain;

public sealed class Achievement
{
    public const int KeyMaxLength = 80;
    public const int TitleMaxLength = 120;
    public const int DescriptionMaxLength = 500;
    public const int RuleMaxLength = 80;

    public string Key { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string Rule { get; set; } = string.Empty;

    public int Target { get; set; }

    public int SortOrder { get; set; }

    public ICollection<UserAchievement> UserAchievements { get; set; } = [];
}
