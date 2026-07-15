using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using LevelHabit.Api.Contracts.Analytics;
using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using LevelHabit.Api.Middleware;
using LevelHabit.Api.Services.Achievements;
using LevelHabit.Api.Services.Progress;
using LevelHabit.Api.Services.Habits;
using Microsoft.EntityFrameworkCore;

namespace LevelHabit.Api.Services.Analytics;

public sealed class AnalyticsService(
    LevelHabitDbContext dbContext,
    TimeProvider timeProvider) : IAnalyticsService
{
    private const int RecentCompletionLimit = 5;
    private const int TrendWindowDays = 7;

    public async Task<AnalyticsSummaryResponse> GetSummaryAsync(
        ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        Guid userId = GetCurrentUserId(principal);
        DateOnly todayUtc = ToUtcDate(timeProvider.GetUtcNow());
        DateOnly weekStartUtc = GetMondayStartOfWeek(todayUtc);
        DateOnly monthStartUtc = new(todayUtc.Year, todayUtc.Month, 1);
        DateOnly trendStartUtc = todayUtc.AddDays(-(TrendWindowDays - 1));

        ProgressProfile progressProfile = await FindProgressProfileAsync(userId, cancellationToken);
        LevelProgress levelProgress = ProgressCalculator.Calculate(progressProfile.TotalXp);
        List<HabitSummary> habits = await LoadHabitsAsync(userId, cancellationToken);
        List<CompletionSummary> completions =
            await LoadCompletionsAsync(userId, cancellationToken);
        List<HabitStreak> streaks = CalculateHabitStreaks(completions, todayUtc);

        int achievementsTotal = await dbContext.Achievements
            .AsNoTracking()
            .CountAsync(cancellationToken);

        if (achievementsTotal == 0)
        {
            achievementsTotal = AchievementCatalog.All.Count;
        }

        int achievementsUnlocked = await dbContext.UserAchievements
            .AsNoTracking()
            .CountAsync(
                userAchievement => userAchievement.UserId == userId,
                cancellationToken);

        return new AnalyticsSummaryResponse(
            TotalHabits: habits.Count,
            ActiveHabits: habits.Count(habit => !habit.IsArchived),
            ArchivedHabits: habits.Count(habit => habit.IsArchived),
            TotalCompletions: completions.Count,
            CompletionsToday: completions.Count(completion =>
                completion.CompletionDateUtc == todayUtc),
            CompletionsThisWeek: completions.Count(completion =>
                completion.CompletionDateUtc >= weekStartUtc
                && completion.CompletionDateUtc <= todayUtc),
            CompletionsThisMonth: completions.Count(completion =>
                completion.CompletionDateUtc >= monthStartUtc
                && completion.CompletionDateUtc <= todayUtc),
            TotalXp: levelProgress.TotalXp,
            CurrentLevel: levelProgress.Level,
            XpToNextLevel: levelProgress.XpToNextLevel,
            CurrentLevelProgressPercent: CalculateProgressPercent(levelProgress),
            CurrentStreakMax: streaks
                .Select(streak => streak.CurrentStreak)
                .DefaultIfEmpty(0)
                .Max(),
            BestStreakMax: streaks
                .Select(streak => streak.BestStreak)
                .DefaultIfEmpty(0)
                .Max(),
            AchievementsUnlocked: achievementsUnlocked,
            AchievementsTotal: achievementsTotal,
            CompletionsByDay: BuildDailyMetrics(
                completions,
                trendStartUtc,
                todayUtc,
                dailyCompletions => dailyCompletions.Count),
            XpByDay: BuildDailyMetrics(
                completions,
                trendStartUtc,
                todayUtc,
                dailyCompletions => dailyCompletions.Sum(completion =>
                    completion.XpAwarded)),
            CompletionCountByCategory: BuildBuckets(
                completions.Select(completion => completion.Category)),
            CompletionCountByDifficulty: BuildBuckets(
                completions.Select(completion => completion.Difficulty)),
            RecentCompletions: completions
                .OrderByDescending(completion => completion.CompletedAtUtc)
                .ThenBy(completion => completion.HabitTitle)
                .Take(RecentCompletionLimit)
                .Select(completion => new AnalyticsRecentCompletionResponse(
                    Id: completion.Id,
                    HabitId: completion.HabitId,
                    HabitTitle: completion.HabitTitle,
                    Category: completion.Category,
                    Difficulty: completion.Difficulty,
                    CompletionDateUtc: completion.CompletionDateUtc,
                    CompletedAtUtc: completion.CompletedAtUtc,
                    XpAwarded: completion.XpAwarded))
                .ToList());
    }

    private async Task<ProgressProfile> FindProgressProfileAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        ProgressProfile? progressProfile = await dbContext.ProgressProfiles
            .AsNoTracking()
            .SingleOrDefaultAsync(
                profile => profile.UserId == userId,
                cancellationToken);

        return progressProfile ?? throw new ApiException(
            StatusCodes.Status404NotFound,
            "Progress profile not found",
            "The current user's progress profile could not be found.");
    }

    private async Task<List<HabitSummary>> LoadHabitsAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        return await dbContext.Habits
            .AsNoTracking()
            .Where(habit => habit.UserId == userId)
            .Select(habit => new HabitSummary(
                habit.IsArchived))
            .ToListAsync(cancellationToken);
    }

    private async Task<List<CompletionSummary>> LoadCompletionsAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        return await (
            from completion in dbContext.HabitCompletions.AsNoTracking()
            join habit in dbContext.Habits.AsNoTracking()
                on completion.HabitId equals habit.Id
            where completion.UserId == userId && habit.UserId == userId
            select new CompletionSummary(
                completion.Id,
                completion.HabitId,
                habit.Title,
                habit.Category,
                habit.Difficulty,
                completion.CompletionDateUtc,
                completion.CompletedAtUtc,
                completion.XpAwarded))
            .ToListAsync(cancellationToken);
    }

    private static List<HabitStreak> CalculateHabitStreaks(
        IReadOnlyList<CompletionSummary> completions,
        DateOnly todayUtc)
    {
        return completions
            .GroupBy(completion => completion.HabitId)
            .Select(group => HabitStreakCalculator.Calculate(
                group.Select(completion => new HabitCompletionStreakEntry(
                    completion.CompletionDateUtc,
                    completion.CompletedAtUtc)),
                todayUtc))
            .ToList();
    }

    private static IReadOnlyList<AnalyticsDailyMetricResponse> BuildDailyMetrics(
        IReadOnlyList<CompletionSummary> completions,
        DateOnly startDateUtc,
        DateOnly endDateUtc,
        Func<IReadOnlyList<CompletionSummary>, int> valueSelector)
    {
        Dictionary<DateOnly, List<CompletionSummary>> completionsByDate = completions
            .Where(completion =>
                completion.CompletionDateUtc >= startDateUtc
                && completion.CompletionDateUtc <= endDateUtc)
            .GroupBy(completion => completion.CompletionDateUtc)
            .ToDictionary(group => group.Key, group => group.ToList());

        List<AnalyticsDailyMetricResponse> metrics = new(capacity: TrendWindowDays);

        for (
            DateOnly date = startDateUtc;
            date <= endDateUtc;
            date = date.AddDays(1))
        {
            int value = completionsByDate.TryGetValue(
                date,
                out List<CompletionSummary>? dailyCompletions)
                ? valueSelector(dailyCompletions)
                : 0;

            metrics.Add(new AnalyticsDailyMetricResponse(date, value));
        }

        return metrics;
    }

    private static IReadOnlyList<AnalyticsBucketResponse> BuildBuckets(
        IEnumerable<string> values)
    {
        return values
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .GroupBy(value => value, StringComparer.OrdinalIgnoreCase)
            .Select(group => new AnalyticsBucketResponse(
                Name: group.Key,
                Count: group.Count()))
            .OrderByDescending(bucket => bucket.Count)
            .ThenBy(bucket => bucket.Name)
            .ToList();
    }

    private static int CalculateProgressPercent(LevelProgress levelProgress)
    {
        if (levelProgress.XpRequiredForNextLevel <= 0)
        {
            return 100;
        }

        int percent = (int)Math.Round(
            (double)levelProgress.XpInCurrentLevel
            / levelProgress.XpRequiredForNextLevel
            * 100,
            MidpointRounding.AwayFromZero);

        return Math.Clamp(percent, 0, 100);
    }

    private static DateOnly GetMondayStartOfWeek(DateOnly todayUtc)
    {
        int daysSinceMonday =
            ((int)todayUtc.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;

        return todayUtc.AddDays(-daysSinceMonday);
    }

    private static DateOnly ToUtcDate(DateTimeOffset timestamp)
    {
        return DateOnly.FromDateTime(timestamp.UtcDateTime);
    }

    private static Guid GetCurrentUserId(ClaimsPrincipal principal)
    {
        string? userIdValue = principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? principal.FindFirstValue(JwtRegisteredClaimNames.Sub);

        if (!Guid.TryParse(userIdValue, out Guid userId))
        {
            throw new ApiException(
                StatusCodes.Status401Unauthorized,
                "Unauthorized",
                "The current access token is missing a valid user identifier.");
        }

        return userId;
    }

    private sealed record HabitSummary(bool IsArchived);

    private sealed record CompletionSummary(
        Guid Id,
        Guid HabitId,
        string HabitTitle,
        string Category,
        string Difficulty,
        DateOnly CompletionDateUtc,
        DateTimeOffset CompletedAtUtc,
        int XpAwarded);
}
