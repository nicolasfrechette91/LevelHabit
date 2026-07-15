using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using LevelHabit.Api.Contracts.Achievements;
using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using LevelHabit.Api.Middleware;
using LevelHabit.Api.Services.Habits;
using Microsoft.EntityFrameworkCore;

namespace LevelHabit.Api.Services.Achievements;

public sealed class AchievementService(
    LevelHabitDbContext dbContext,
    TimeProvider timeProvider) : IAchievementService
{
    public async Task<IReadOnlyList<AchievementResponse>> ListAsync(
        ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        Guid userId = GetCurrentUserId(principal);

        await UnlockEligibleAsync(
            userId,
            timeProvider.GetUtcNow(),
            cancellationToken);

        return await GetResponsesAsync(userId, cancellationToken);
    }

    public async Task<IReadOnlyList<AchievementResponse>> UnlockEligibleAsync(
        Guid userId,
        DateTimeOffset unlockedAtUtc,
        CancellationToken cancellationToken)
    {
        AchievementProgressSnapshot progress = await LoadProgressAsync(
            userId,
            cancellationToken);

        HashSet<string> unlockedKeys = await dbContext.UserAchievements
            .AsNoTracking()
            .Where(userAchievement => userAchievement.UserId == userId)
            .Select(userAchievement => userAchievement.AchievementKey)
            .ToHashSetAsync(cancellationToken);

        List<UserAchievement> newlyUnlocked = AchievementCatalog.All
            .Where(achievement =>
                !unlockedKeys.Contains(achievement.Key)
                && IsUnlocked(achievement, progress))
            .Select(achievement => new UserAchievement
            {
                UserId = userId,
                AchievementKey = achievement.Key,
                UnlockedAtUtc = unlockedAtUtc
            })
            .ToList();

        if (newlyUnlocked.Count == 0)
        {
            return [];
        }

        dbContext.UserAchievements.AddRange(newlyUnlocked);
        await dbContext.SaveChangesAsync(cancellationToken);

        return newlyUnlocked
            .Select(userAchievement =>
            {
                AchievementDefinition achievement = AchievementCatalog.GetRequired(
                    userAchievement.AchievementKey);

                return ToResponse(
                    achievement,
                    userAchievement.UnlockedAtUtc,
                    progress);
            })
            .ToList();
    }

    private async Task<IReadOnlyList<AchievementResponse>> GetResponsesAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        AchievementProgressSnapshot progress = await LoadProgressAsync(
            userId,
            cancellationToken);

        Dictionary<string, DateTimeOffset> unlockedAtByKey =
            await dbContext.UserAchievements
                .AsNoTracking()
                .Where(userAchievement => userAchievement.UserId == userId)
                .ToDictionaryAsync(
                    userAchievement => userAchievement.AchievementKey,
                    userAchievement => userAchievement.UnlockedAtUtc,
                    cancellationToken);

        return AchievementCatalog.All
            .OrderBy(achievement => achievement.SortOrder)
            .Select(achievement =>
            {
                unlockedAtByKey.TryGetValue(
                    achievement.Key,
                    out DateTimeOffset unlockedAtUtc);

                return ToResponse(
                    achievement,
                    unlockedAtByKey.ContainsKey(achievement.Key)
                        ? unlockedAtUtc
                        : null,
                    progress);
            })
            .ToList();
    }

    private async Task<AchievementProgressSnapshot> LoadProgressAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        int? profileLevel = await dbContext.ProgressProfiles
            .AsNoTracking()
            .Where(profile => profile.UserId == userId)
            .Select(profile => (int?)profile.Level)
            .SingleOrDefaultAsync(cancellationToken);

        if (!profileLevel.HasValue)
        {
            throw new ApiException(
                StatusCodes.Status404NotFound,
                "Progress profile not found",
                "The current user's progress profile could not be found.");
        }

        List<CompletionActivity> completions = await (
            from completion in dbContext.HabitCompletions.AsNoTracking()
            join habit in dbContext.Habits.AsNoTracking()
                on completion.HabitId equals habit.Id
            where completion.UserId == userId && habit.UserId == userId
            select new CompletionActivity(
                completion.HabitId,
                completion.CompletionDateUtc,
                completion.CompletedAtUtc,
                habit.Category,
                habit.Difficulty))
            .ToListAsync(cancellationToken);

        int bestHabitStreak = completions
            .GroupBy(completion => completion.HabitId)
            .Select(group => HabitStreakCalculator.Calculate(
                group.Select(completion => new HabitCompletionStreakEntry(
                    completion.CompletionDateUtc,
                    completion.CompletedAtUtc)),
                GetTodayUtc()).BestStreak)
            .DefaultIfEmpty(0)
            .Max();

        int completedCategories = completions
            .Select(completion => completion.Category)
            .Where(category => !string.IsNullOrWhiteSpace(category))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count();

        bool hasHardCompletion = completions.Any(completion =>
            string.Equals(
                completion.Difficulty,
                "Hard",
                StringComparison.OrdinalIgnoreCase));

        return new AchievementProgressSnapshot(
            TotalCompletions: completions.Count,
            ProfileLevel: profileLevel.Value,
            BestHabitStreak: bestHabitStreak,
            HasHardCompletion: hasHardCompletion,
            CompletedCategories: completedCategories);
    }

    private static bool IsUnlocked(
        AchievementDefinition achievement,
        AchievementProgressSnapshot progress)
    {
        return ProgressFor(achievement, progress) >= achievement.Target;
    }

    private static AchievementResponse ToResponse(
        AchievementDefinition achievement,
        DateTimeOffset? unlockedAtUtc,
        AchievementProgressSnapshot progress)
    {
        int currentProgress = ProgressFor(achievement, progress);
        int cappedProgress = Math.Min(currentProgress, achievement.Target);

        return new AchievementResponse(
            Key: achievement.Key,
            Title: achievement.Title,
            Description: achievement.Description,
            Rule: achievement.Rule,
            IsUnlocked: unlockedAtUtc.HasValue,
            UnlockedAtUtc: unlockedAtUtc,
            Progress: cappedProgress,
            Target: achievement.Target,
            ProgressText: BuildProgressText(
                achievement,
                cappedProgress,
                achievement.Target));
    }

    private static int ProgressFor(
        AchievementDefinition achievement,
        AchievementProgressSnapshot progress)
    {
        return achievement.Rule switch
        {
            AchievementRules.TotalCompletions => progress.TotalCompletions,
            AchievementRules.Level => progress.ProfileLevel,
            AchievementRules.BestHabitStreak => progress.BestHabitStreak,
            AchievementRules.HardCompletion => progress.HasHardCompletion ? 1 : 0,
            AchievementRules.CompletedCategories => progress.CompletedCategories,
            _ => 0
        };
    }

    private static string BuildProgressText(
        AchievementDefinition achievement,
        int progress,
        int target)
    {
        return achievement.Rule switch
        {
            AchievementRules.TotalCompletions =>
                $"{progress}/{target} habit completions",
            AchievementRules.Level =>
                $"Level {progress}/{target}",
            AchievementRules.BestHabitStreak =>
                $"{progress}/{target} day streak",
            AchievementRules.HardCompletion =>
                $"{progress}/{target} hard habit",
            AchievementRules.CompletedCategories =>
                $"{progress}/{target} categories",
            _ => $"{progress}/{target}"
        };
    }

    private DateOnly GetTodayUtc()
    {
        return DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
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

    private sealed record CompletionActivity(
        Guid HabitId,
        DateOnly CompletionDateUtc,
        DateTimeOffset CompletedAtUtc,
        string Category,
        string Difficulty);

    private sealed record AchievementProgressSnapshot(
        int TotalCompletions,
        int ProfileLevel,
        int BestHabitStreak,
        bool HasHardCompletion,
        int CompletedCategories);
}
