using System.Security.Claims;
using LevelHabit.Api.Contracts.Analytics;
using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using LevelHabit.Api.Middleware;
using LevelHabit.Api.Services.Achievements;
using LevelHabit.Api.Services.Analytics;
using LevelHabit.Api.Services.Heroes;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace LevelHabit.Api.Tests;

public sealed class AnalyticsServiceTests
{
    [Fact]
    public async Task GetSummaryAsync_returns_current_users_persisted_analytics()
    {
        using AnalyticsServiceHarness harness = AnalyticsServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com", totalXp: 320);
        Guid healthQuestId = await harness.AddQuestAsync(
            userId,
            "Morning training",
            category: "Health",
            difficulty: "Easy");
        Guid codingQuestId = await harness.AddQuestAsync(
            userId,
            "Ship practice",
            category: "Coding",
            difficulty: "Hard");
        Guid choresQuestId = await harness.AddQuestAsync(
            userId,
            "Room reset",
            category: "Chores",
            difficulty: "Medium",
            isArchived: true);
        await harness.AddCompletionAsync(
            userId,
            healthQuestId,
            new DateOnly(2026, 6, 17),
            hour: 8,
            xpAwarded: 10);
        await harness.AddCompletionAsync(
            userId,
            healthQuestId,
            new DateOnly(2026, 6, 18),
            hour: 8,
            xpAwarded: 10);
        await harness.AddCompletionAsync(
            userId,
            healthQuestId,
            new DateOnly(2026, 6, 19),
            hour: 8,
            xpAwarded: 10);
        await harness.AddCompletionAsync(
            userId,
            codingQuestId,
            new DateOnly(2026, 6, 15),
            hour: 9,
            xpAwarded: 35);
        await harness.AddCompletionAsync(
            userId,
            codingQuestId,
            new DateOnly(2026, 6, 1),
            hour: 9,
            xpAwarded: 35);
        await harness.AddCompletionAsync(
            userId,
            choresQuestId,
            new DateOnly(2026, 5, 31),
            hour: 10,
            xpAwarded: 20);
        await harness.AddUnlockedAchievementAsync(userId, AchievementCatalog.FirstStep);
        await harness.AddUnlockedAchievementAsync(userId, AchievementCatalog.HardMode);

        AnalyticsSummaryResponse summary = await harness.Service.GetSummaryAsync(
            harness.CreatePrincipal(userId),
            CancellationToken.None);

        Assert.Equal(3, summary.TotalQuests);
        Assert.Equal(2, summary.ActiveQuests);
        Assert.Equal(1, summary.ArchivedQuests);
        Assert.Equal(6, summary.TotalCompletions);
        Assert.Equal(1, summary.CompletionsToday);
        Assert.Equal(4, summary.CompletionsThisWeek);
        Assert.Equal(5, summary.CompletionsThisMonth);
        Assert.Equal(320, summary.TotalXp);
        Assert.Equal(3, summary.CurrentLevel);
        Assert.Equal(280, summary.XpToNextLevel);
        Assert.Equal(7, summary.CurrentLevelProgressPercent);
        Assert.Equal(3, summary.CurrentStreakMax);
        Assert.Equal(3, summary.BestStreakMax);
        Assert.Equal(2, summary.AchievementsUnlocked);
        Assert.Equal(AchievementCatalog.All.Count, summary.AchievementsTotal);
        AssertBucket(summary.CompletionCountByCategory, "Health", 3);
        AssertBucket(summary.CompletionCountByCategory, "Coding", 2);
        AssertBucket(summary.CompletionCountByCategory, "Chores", 1);
        AssertBucket(summary.CompletionCountByDifficulty, "Easy", 3);
        AssertBucket(summary.CompletionCountByDifficulty, "Hard", 2);
        AssertBucket(summary.CompletionCountByDifficulty, "Medium", 1);
        Assert.Equal(5, summary.RecentCompletions.Count);
        Assert.Equal(healthQuestId, summary.RecentCompletions[0].QuestId);
        Assert.Equal(new DateOnly(2026, 6, 19), summary.RecentCompletions[0].CompletionDateUtc);
        Assert.DoesNotContain(
            summary.RecentCompletions,
            completion => completion.QuestId == choresQuestId);
    }

    [Fact]
    public async Task GetSummaryAsync_excludes_other_users_data()
    {
        using AnalyticsServiceHarness harness = AnalyticsServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com", totalXp: 100);
        Guid otherUserId = await harness.AddUserAsync("other@example.com", totalXp: 500);
        Guid ownQuestId = await harness.AddQuestAsync(
            userId,
            "Private quest",
            category: "Health",
            difficulty: "Easy");
        Guid otherQuestId = await harness.AddQuestAsync(
            otherUserId,
            "Other quest",
            category: "Coding",
            difficulty: "Hard");

        await harness.AddCompletionAsync(
            userId,
            ownQuestId,
            new DateOnly(2026, 6, 19),
            hour: 8,
            xpAwarded: 10);
        await harness.AddCompletionAsync(
            otherUserId,
            otherQuestId,
            new DateOnly(2026, 6, 19),
            hour: 9,
            xpAwarded: 35);
        await harness.AddCompletionAsync(
            otherUserId,
            otherQuestId,
            new DateOnly(2026, 6, 18),
            hour: 9,
            xpAwarded: 35);
        await harness.AddUnlockedAchievementAsync(userId, AchievementCatalog.FirstStep);
        await harness.AddUnlockedAchievementAsync(otherUserId, AchievementCatalog.HardMode);

        AnalyticsSummaryResponse summary = await harness.Service.GetSummaryAsync(
            harness.CreatePrincipal(userId),
            CancellationToken.None);

        Assert.Equal(1, summary.TotalQuests);
        Assert.Equal(1, summary.TotalCompletions);
        Assert.Equal(100, summary.TotalXp);
        Assert.Equal(2, summary.CurrentLevel);
        Assert.Equal(1, summary.AchievementsUnlocked);
        Assert.Single(summary.CompletionCountByCategory);
        AssertBucket(summary.CompletionCountByCategory, "Health", 1);
        Assert.DoesNotContain(
            summary.CompletionCountByCategory,
            bucket => bucket.Name == "Coding");
        Assert.Single(summary.RecentCompletions);
        Assert.Equal(ownQuestId, summary.RecentCompletions[0].QuestId);
    }

    [Fact]
    public async Task GetSummaryAsync_empty_account_returns_zero_defaults()
    {
        using AnalyticsServiceHarness harness = AnalyticsServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");

        AnalyticsSummaryResponse summary = await harness.Service.GetSummaryAsync(
            harness.CreatePrincipal(userId),
            CancellationToken.None);

        Assert.Equal(0, summary.TotalQuests);
        Assert.Equal(0, summary.ActiveQuests);
        Assert.Equal(0, summary.ArchivedQuests);
        Assert.Equal(0, summary.TotalCompletions);
        Assert.Equal(0, summary.CompletionsToday);
        Assert.Equal(0, summary.CompletionsThisWeek);
        Assert.Equal(0, summary.CompletionsThisMonth);
        Assert.Equal(0, summary.TotalXp);
        Assert.Equal(1, summary.CurrentLevel);
        Assert.Equal(100, summary.XpToNextLevel);
        Assert.Equal(0, summary.CurrentLevelProgressPercent);
        Assert.Equal(0, summary.CurrentStreakMax);
        Assert.Equal(0, summary.BestStreakMax);
        Assert.Equal(0, summary.AchievementsUnlocked);
        Assert.Equal(AchievementCatalog.All.Count, summary.AchievementsTotal);
        Assert.Empty(summary.CompletionCountByCategory);
        Assert.Empty(summary.CompletionCountByDifficulty);
        Assert.Empty(summary.RecentCompletions);
    }

    [Fact]
    public async Task GetSummaryAsync_without_authenticated_user_is_rejected()
    {
        using AnalyticsServiceHarness harness = AnalyticsServiceHarness.Create();
        ClaimsPrincipal unauthenticatedUser = new(new ClaimsIdentity());

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.GetSummaryAsync(
                unauthenticatedUser,
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status401Unauthorized, exception.StatusCode);
    }

    private static void AssertBucket(
        IReadOnlyList<AnalyticsBucketResponse> buckets,
        string name,
        int expectedCount)
    {
        AnalyticsBucketResponse bucket = buckets.Single(candidate =>
            candidate.Name == name);

        Assert.Equal(expectedCount, bucket.Count);
    }

    private sealed class AnalyticsServiceHarness : IDisposable
    {
        private AnalyticsServiceHarness(
            LevelHabitDbContext dbContext,
            IAnalyticsService service,
            TestTimeProvider time)
        {
            DbContext = dbContext;
            Service = service;
            Time = time;
        }

        public LevelHabitDbContext DbContext { get; }

        public IAnalyticsService Service { get; }

        public TestTimeProvider Time { get; }

        public static AnalyticsServiceHarness Create()
        {
            DbContextOptions<LevelHabitDbContext> options =
                new DbContextOptionsBuilder<LevelHabitDbContext>()
                    .UseInMemoryDatabase(Guid.NewGuid().ToString())
                    .Options;

            LevelHabitDbContext dbContext = new(options);
            TestTimeProvider time = new(
                new DateTimeOffset(2026, 6, 19, 12, 0, 0, TimeSpan.Zero));
            AnalyticsService service = new(dbContext, time);

            return new AnalyticsServiceHarness(dbContext, service, time);
        }

        public ClaimsPrincipal CreatePrincipal(Guid userId)
        {
            return new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, userId.ToString())],
                authenticationType: "Test"));
        }

        public async Task<Guid> AddUserAsync(string email, int totalXp = 0)
        {
            Guid userId = Guid.NewGuid();
            DateTimeOffset now = Time.GetUtcNow();
            HeroProgress progress = HeroProgressCalculator.Calculate(totalXp);

            DbContext.Users.Add(new User
            {
                Id = userId,
                Email = email,
                NormalizedEmail = email.ToUpperInvariant(),
                DisplayName = email,
                PasswordHash = "test-password-hash",
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            });

            DbContext.HeroProfiles.Add(new HeroProfile
            {
                UserId = userId,
                HeroName = "Test Hero",
                Level = progress.Level,
                TotalXp = progress.TotalXp,
                CurrentStreak = 0,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            });

            await DbContext.SaveChangesAsync();

            return userId;
        }

        public async Task<Guid> AddQuestAsync(
            Guid userId,
            string title,
            string category,
            string difficulty,
            bool isArchived = false)
        {
            DateTimeOffset now = Time.GetUtcNow();
            Quest quest = new()
            {
                UserId = userId,
                Title = title,
                Description = "Test quest",
                Category = category,
                Difficulty = difficulty,
                Frequency = "Daily",
                IsArchived = isArchived,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            };

            DbContext.Quests.Add(quest);
            await DbContext.SaveChangesAsync();

            return quest.Id;
        }

        public async Task AddCompletionAsync(
            Guid userId,
            Guid questId,
            DateOnly completionDateUtc,
            int hour,
            int xpAwarded)
        {
            DbContext.QuestCompletions.Add(new QuestCompletion
            {
                UserId = userId,
                QuestId = questId,
                CompletionDateUtc = completionDateUtc,
                CompletedAtUtc = new DateTimeOffset(
                    completionDateUtc.Year,
                    completionDateUtc.Month,
                    completionDateUtc.Day,
                    hour,
                    0,
                    0,
                    TimeSpan.Zero),
                XpAwarded = xpAwarded
            });

            await DbContext.SaveChangesAsync();
        }

        public async Task AddUnlockedAchievementAsync(
            Guid userId,
            string achievementKey)
        {
            DbContext.UserAchievements.Add(new UserAchievement
            {
                UserId = userId,
                AchievementKey = achievementKey,
                UnlockedAtUtc = Time.GetUtcNow()
            });

            await DbContext.SaveChangesAsync();
        }

        public void Dispose()
        {
            DbContext.Dispose();
        }
    }

    private sealed class TestTimeProvider(DateTimeOffset currentUtc) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => currentUtc;
    }
}
