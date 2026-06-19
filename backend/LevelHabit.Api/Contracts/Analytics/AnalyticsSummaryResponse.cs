namespace LevelHabit.Api.Contracts.Analytics;

public sealed record AnalyticsSummaryResponse(
    int TotalQuests,
    int ActiveQuests,
    int ArchivedQuests,
    int TotalCompletions,
    int CompletionsToday,
    int CompletionsThisWeek,
    int CompletionsThisMonth,
    int TotalXp,
    int CurrentLevel,
    int XpToNextLevel,
    int CurrentLevelProgressPercent,
    int CurrentStreakMax,
    int BestStreakMax,
    int AchievementsUnlocked,
    int AchievementsTotal,
    IReadOnlyList<AnalyticsBucketResponse> CompletionCountByCategory,
    IReadOnlyList<AnalyticsBucketResponse> CompletionCountByDifficulty,
    IReadOnlyList<AnalyticsRecentCompletionResponse> RecentCompletions);
