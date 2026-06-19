namespace LevelHabit.Api.Services.Achievements;

public static class AchievementCatalog
{
    public const string FirstStep = "first-step";
    public const string GettingStarted = "getting-started";
    public const string Dedicated = "dedicated";
    public const string LevelUp = "level-up";
    public const string HeroRising = "hero-rising";
    public const string OnFire = "on-fire";
    public const string Unstoppable = "unstoppable";
    public const string HardMode = "hard-mode";
    public const string BalancedHero = "balanced-hero";

    public static readonly IReadOnlyList<AchievementDefinition> All =
    [
        new(
            FirstStep,
            "First Step",
            "Complete your first quest.",
            AchievementRules.TotalCompletions,
            Target: 1,
            SortOrder: 10),
        new(
            GettingStarted,
            "Getting Started",
            "Complete 5 quests total.",
            AchievementRules.TotalCompletions,
            Target: 5,
            SortOrder: 20),
        new(
            Dedicated,
            "Dedicated",
            "Complete 25 quests total.",
            AchievementRules.TotalCompletions,
            Target: 25,
            SortOrder: 30),
        new(
            LevelUp,
            "Level Up",
            "Reach hero level 2.",
            AchievementRules.Level,
            Target: 2,
            SortOrder: 40),
        new(
            HeroRising,
            "Hero Rising",
            "Reach hero level 5.",
            AchievementRules.Level,
            Target: 5,
            SortOrder: 50),
        new(
            OnFire,
            "On Fire",
            "Reach a 3-day streak on any quest.",
            AchievementRules.BestQuestStreak,
            Target: 3,
            SortOrder: 60),
        new(
            Unstoppable,
            "Unstoppable",
            "Reach a 7-day streak on any quest.",
            AchievementRules.BestQuestStreak,
            Target: 7,
            SortOrder: 70),
        new(
            HardMode,
            "Hard Mode",
            "Complete a hard quest.",
            AchievementRules.HardCompletion,
            Target: 1,
            SortOrder: 80),
        new(
            BalancedHero,
            "Balanced Hero",
            "Complete quests in at least 3 different categories.",
            AchievementRules.CompletedCategories,
            Target: 3,
            SortOrder: 90)
    ];

    public static AchievementDefinition GetRequired(string key)
    {
        return All.Single(achievement => achievement.Key == key);
    }
}
