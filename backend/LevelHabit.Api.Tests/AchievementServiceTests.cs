using System.Security.Claims;
using LevelHabit.Api.Contracts.Achievements;
using LevelHabit.Api.Contracts.Habits;
using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using LevelHabit.Api.Middleware;
using LevelHabit.Api.Services.Achievements;
using LevelHabit.Api.Services.Progress;
using LevelHabit.Api.Services.Habits;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace LevelHabit.Api.Tests;

public sealed class AchievementServiceTests
{
    [Fact]
    public async Task Habit_completion_unlocks_first_step()
    {
        using AchievementServiceHarness harness = AchievementServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        HabitResponse habit = await harness.CreateHabitAsync(userId, "First habit");

        await harness.HabitService.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            habit.Id,
            CancellationToken.None);

        IReadOnlyList<AchievementResponse> achievements =
            await harness.Service.ListAsync(
                harness.CreatePrincipal(userId),
                CancellationToken.None);

        AchievementResponse firstStep = FindAchievement(
            achievements,
            AchievementCatalog.FirstStep);

        Assert.True(firstStep.IsUnlocked);
        Assert.Equal(harness.Time.GetUtcNow(), firstStep.UnlockedAtUtc);
        Assert.Equal(1, await harness.DbContext.UserAchievements.CountAsync());
    }

    [Theory]
    [InlineData(5, AchievementCatalog.GettingStarted)]
    [InlineData(25, AchievementCatalog.Dedicated)]
    public async Task Total_completions_unlock_threshold_achievements(
        int completionCount,
        string achievementKey)
    {
        using AchievementServiceHarness harness = AchievementServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");

        for (int index = 0; index < completionCount; index++)
        {
            HabitResponse habit = await harness.CreateHabitAsync(
                userId,
                $"Habit {index}");

            await harness.HabitService.CompleteTodayAsync(
                harness.CreatePrincipal(userId),
                habit.Id,
                CancellationToken.None);
        }

        IReadOnlyList<AchievementResponse> achievements =
            await harness.Service.ListAsync(
                harness.CreatePrincipal(userId),
                CancellationToken.None);

        AchievementResponse achievement = FindAchievement(
            achievements,
            achievementKey);

        Assert.True(achievement.IsUnlocked);
        Assert.Equal(completionCount, achievement.Progress);
    }

    [Fact]
    public async Task Reaching_level_unlocks_level_achievements()
    {
        using AchievementServiceHarness harness = AchievementServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        await harness.SetProgressXpAsync(userId, totalXp: 990);
        HabitResponse habit = await harness.CreateHabitAsync(
            userId,
            "Progress Rising",
            difficulty: "Easy");

        await harness.HabitService.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            habit.Id,
            CancellationToken.None);

        IReadOnlyList<AchievementResponse> achievements =
            await harness.Service.ListAsync(
                harness.CreatePrincipal(userId),
                CancellationToken.None);

        Assert.True(FindAchievement(
            achievements,
            AchievementCatalog.LevelUp).IsUnlocked);
        Assert.True(FindAchievement(
            achievements,
            AchievementCatalog.ProgressRising).IsUnlocked);
    }

    [Theory]
    [InlineData(3, AchievementCatalog.OnFire)]
    [InlineData(7, AchievementCatalog.Unstoppable)]
    public async Task Streak_thresholds_unlock_streak_achievements(
        int streakLength,
        string achievementKey)
    {
        using AchievementServiceHarness harness = AchievementServiceHarness.Create();
        harness.Time.SetUtcNow(new DateTimeOffset(2026, 6, 1, 12, 0, 0, TimeSpan.Zero));
        Guid userId = await harness.AddUserAsync("player@example.com");
        HabitResponse habit = await harness.CreateHabitAsync(userId, "Daily practice");

        for (int day = 0; day < streakLength; day++)
        {
            harness.Time.SetUtcNow(
                new DateTimeOffset(2026, 6, 1 + day, 12, 0, 0, TimeSpan.Zero));

            await harness.HabitService.CompleteTodayAsync(
                harness.CreatePrincipal(userId),
                habit.Id,
                CancellationToken.None);
        }

        IReadOnlyList<AchievementResponse> achievements =
            await harness.Service.ListAsync(
                harness.CreatePrincipal(userId),
                CancellationToken.None);

        AchievementResponse achievement = FindAchievement(
            achievements,
            achievementKey);

        Assert.True(achievement.IsUnlocked);
        Assert.Equal(streakLength, achievement.Progress);
    }

    [Fact]
    public async Task Completing_hard_habit_unlocks_hard_mode()
    {
        using AchievementServiceHarness harness = AchievementServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        HabitResponse habit = await harness.CreateHabitAsync(
            userId,
            "Boss training",
            difficulty: "Hard");

        await harness.HabitService.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            habit.Id,
            CancellationToken.None);

        IReadOnlyList<AchievementResponse> achievements =
            await harness.Service.ListAsync(
                harness.CreatePrincipal(userId),
                CancellationToken.None);

        Assert.True(FindAchievement(
            achievements,
            AchievementCatalog.HardMode).IsUnlocked);
    }

    [Fact]
    public async Task Completing_three_categories_unlocks_balanced_progress()
    {
        using AchievementServiceHarness harness = AchievementServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");

        foreach (string category in new[] { "Health", "Learning", "Coding" })
        {
            HabitResponse habit = await harness.CreateHabitAsync(
                userId,
                $"{category} habit",
                category: category);

            await harness.HabitService.CompleteTodayAsync(
                harness.CreatePrincipal(userId),
                habit.Id,
                CancellationToken.None);
        }

        IReadOnlyList<AchievementResponse> achievements =
            await harness.Service.ListAsync(
                harness.CreatePrincipal(userId),
                CancellationToken.None);

        AchievementResponse balancedProgress = FindAchievement(
            achievements,
            AchievementCatalog.BalancedProgress);

        Assert.True(balancedProgress.IsUnlocked);
        Assert.Equal(3, balancedProgress.Progress);
    }

    [Fact]
    public async Task Unlocking_is_idempotent()
    {
        using AchievementServiceHarness harness = AchievementServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        HabitResponse habit = await harness.CreateHabitAsync(userId, "Only once");

        await harness.HabitService.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            habit.Id,
            CancellationToken.None);

        await harness.Service.ListAsync(
            harness.CreatePrincipal(userId),
            CancellationToken.None);

        int unlockedCount = await harness.DbContext.UserAchievements
            .CountAsync(userAchievement => userAchievement.UserId == userId);

        await harness.Service.UnlockEligibleAsync(
            userId,
            harness.Time.GetUtcNow(),
            CancellationToken.None);

        await harness.HabitService.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            habit.Id,
            CancellationToken.None);

        Assert.Equal(
            unlockedCount,
            await harness.DbContext.UserAchievements
                .CountAsync(userAchievement => userAchievement.UserId == userId));
    }

    [Fact]
    public async Task Users_cannot_see_another_users_unlocked_achievements()
    {
        using AchievementServiceHarness harness = AchievementServiceHarness.Create();
        Guid firstUserId = await harness.AddUserAsync("first@example.com");
        Guid secondUserId = await harness.AddUserAsync("second@example.com");
        HabitResponse habit = await harness.CreateHabitAsync(firstUserId, "Private win");

        await harness.HabitService.CompleteTodayAsync(
            harness.CreatePrincipal(firstUserId),
            habit.Id,
            CancellationToken.None);

        IReadOnlyList<AchievementResponse> secondUserAchievements =
            await harness.Service.ListAsync(
                harness.CreatePrincipal(secondUserId),
                CancellationToken.None);

        AchievementResponse firstStep = FindAchievement(
            secondUserAchievements,
            AchievementCatalog.FirstStep);

        Assert.False(firstStep.IsUnlocked);
        Assert.Null(firstStep.UnlockedAtUtc);
        Assert.DoesNotContain(
            harness.DbContext.UserAchievements,
            userAchievement => userAchievement.UserId == secondUserId);
    }

    [Fact]
    public async Task ListAsync_without_authenticated_user_is_rejected()
    {
        using AchievementServiceHarness harness = AchievementServiceHarness.Create();
        ClaimsPrincipal unauthenticatedUser = new(new ClaimsIdentity());

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.ListAsync(
                unauthenticatedUser,
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status401Unauthorized, exception.StatusCode);
    }

    private static AchievementResponse FindAchievement(
        IReadOnlyList<AchievementResponse> achievements,
        string key)
    {
        return achievements.Single(achievement => achievement.Key == key);
    }

    private sealed class AchievementServiceHarness : IDisposable
    {
        private AchievementServiceHarness(
            LevelHabitDbContext dbContext,
            IAchievementService service,
            IHabitService habitService,
            TestTimeProvider time)
        {
            DbContext = dbContext;
            Service = service;
            HabitService = habitService;
            Time = time;
        }

        public LevelHabitDbContext DbContext { get; }

        public IAchievementService Service { get; }

        public IHabitService HabitService { get; }

        public TestTimeProvider Time { get; }

        public static AchievementServiceHarness Create()
        {
            DbContextOptions<LevelHabitDbContext> options =
                new DbContextOptionsBuilder<LevelHabitDbContext>()
                    .UseInMemoryDatabase(Guid.NewGuid().ToString())
                    .Options;

            LevelHabitDbContext dbContext = new(options);
            TestTimeProvider time = new(
                new DateTimeOffset(2026, 6, 18, 12, 0, 0, TimeSpan.Zero));
            AchievementService achievementService = new(dbContext, time);
            HabitService habitService = new(dbContext, time, achievementService);

            return new AchievementServiceHarness(
                dbContext,
                achievementService,
                habitService,
                time);
        }

        public ClaimsPrincipal CreatePrincipal(Guid userId)
        {
            return new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, userId.ToString())],
                authenticationType: "Test"));
        }

        public async Task<Guid> AddUserAsync(string email)
        {
            Guid userId = Guid.NewGuid();
            DateTimeOffset now = Time.GetUtcNow();

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

            DbContext.ProgressProfiles.Add(new ProgressProfile
            {
                UserId = userId,
                DisplayName = "Test Profile",
                Level = 1,
                TotalXp = 0,
                CurrentStreak = 0,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            });

            await DbContext.SaveChangesAsync();

            return userId;
        }

        public async Task SetProgressXpAsync(Guid userId, int totalXp)
        {
            ProgressProfile progressProfile = await DbContext.ProgressProfiles.SingleAsync(
                profile => profile.UserId == userId);
            LevelProgress progress = ProgressCalculator.Calculate(totalXp);

            progressProfile.TotalXp = progress.TotalXp;
            progressProfile.Level = progress.Level;
            progressProfile.UpdatedAtUtc = Time.GetUtcNow();

            await DbContext.SaveChangesAsync();
        }

        public Task<HabitResponse> CreateHabitAsync(
            Guid userId,
            string title,
            string category = "Health",
            string difficulty = "Easy")
        {
            return HabitService.CreateAsync(
                CreatePrincipal(userId),
                new CreateHabitRequest(
                    Title: title,
                    Description: "Test habit",
                    Category: category,
                    Difficulty: difficulty,
                    Frequency: "Daily"),
                CancellationToken.None);
        }

        public void Dispose()
        {
            DbContext.Dispose();
        }
    }

    private sealed class TestTimeProvider(DateTimeOffset currentUtc) : TimeProvider
    {
        private DateTimeOffset currentUtc = currentUtc;

        public override DateTimeOffset GetUtcNow() => currentUtc;

        public void SetUtcNow(DateTimeOffset timestamp)
        {
            currentUtc = timestamp.ToUniversalTime();
        }
    }
}
