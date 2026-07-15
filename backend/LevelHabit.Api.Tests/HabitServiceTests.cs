using System.Security.Claims;
using LevelHabit.Api.Contracts.Habits;
using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using LevelHabit.Api.Middleware;
using LevelHabit.Api.Services.Achievements;
using LevelHabit.Api.Services.Habits;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace LevelHabit.Api.Tests;

public sealed class HabitServiceTests
{
    [Fact]
    public async Task CreateAsync_creates_habit_for_authenticated_user()
    {
        using HabitServiceHarness harness = HabitServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");

        HabitResponse habit = await harness.Service.CreateAsync(
            harness.CreatePrincipal(userId),
            new CreateHabitRequest(
                Title: " Morning training ",
                Description: " Move before work. ",
                Category: "fitness",
                Difficulty: "medium",
                Frequency: "daily"),
            CancellationToken.None);

        Assert.NotEqual(Guid.Empty, habit.Id);
        Assert.Equal(userId, habit.UserId);
        Assert.Equal("Morning training", habit.Title);
        Assert.Equal("Move before work.", habit.Description);
        Assert.Equal("Fitness", habit.Category);
        Assert.Equal("Medium", habit.Difficulty);
        Assert.Equal("Daily", habit.Frequency);
        Assert.False(habit.IsArchived);

        Habit storedHabit = await harness.DbContext.Habits.SingleAsync();
        Assert.Equal(userId, storedHabit.UserId);
    }

    [Fact]
    public async Task ListAsync_returns_only_the_authenticated_users_active_habits()
    {
        using HabitServiceHarness harness = HabitServiceHarness.Create();
        Guid firstUserId = await harness.AddUserAsync("first@example.com");
        Guid secondUserId = await harness.AddUserAsync("second@example.com");

        HabitResponse ownActiveHabit = await harness.CreateHabitAsync(firstUserId, "Own active");
        await harness.CreateHabitAsync(secondUserId, "Other user active");
        HabitResponse archivedHabit = await harness.CreateHabitAsync(firstUserId, "Own archived");
        await harness.Service.ArchiveAsync(
            harness.CreatePrincipal(firstUserId),
            archivedHabit.Id,
            CancellationToken.None);

        IReadOnlyList<HabitResponse> habits = await harness.Service.ListAsync(
            harness.CreatePrincipal(firstUserId),
            includeArchived: false,
            CancellationToken.None);

        HabitResponse habit = Assert.Single(habits);
        Assert.Equal(ownActiveHabit.Id, habit.Id);
    }

    [Fact]
    public async Task ListAsync_does_not_return_another_users_completed_habit()
    {
        using HabitServiceHarness harness = HabitServiceHarness.Create();
        Guid firstUserId = await harness.AddUserAsync("first@example.com");
        Guid secondUserId = await harness.AddUserAsync("second@example.com");
        HabitResponse drinkWater = await harness.CreateHabitAsync(firstUserId, "Drink Water");

        await harness.Service.CompleteTodayAsync(
            harness.CreatePrincipal(firstUserId),
            drinkWater.Id,
            CancellationToken.None);

        IReadOnlyList<HabitResponse> secondUserHabits = await harness.Service.ListAsync(
            harness.CreatePrincipal(secondUserId),
            includeArchived: true,
            CancellationToken.None);

        Assert.Empty(secondUserHabits);

        ProgressProfile secondUserProfile = await harness.DbContext.ProgressProfiles
            .SingleAsync(profile => profile.UserId == secondUserId);
        Assert.Equal(0, secondUserProfile.TotalXp);
    }

    [Fact]
    public async Task UpdateAsync_updates_the_authenticated_users_habit()
    {
        using HabitServiceHarness harness = HabitServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        HabitResponse created = await harness.CreateHabitAsync(userId, "Original title");

        harness.Time.Advance(TimeSpan.FromMinutes(5));

        HabitResponse updated = await harness.Service.UpdateAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            new UpdateHabitRequest(
                Title: "Study sprint",
                Description: "Read one chapter.",
                Category: "Learning",
                Difficulty: "Easy",
                Frequency: "Weekly"),
            CancellationToken.None);

        Assert.Equal(created.Id, updated.Id);
        Assert.Equal("Study sprint", updated.Title);
        Assert.Equal("Read one chapter.", updated.Description);
        Assert.Equal("Learning", updated.Category);
        Assert.Equal("Easy", updated.Difficulty);
        Assert.Equal("Weekly", updated.Frequency);
        Assert.True(updated.UpdatedAtUtc > created.UpdatedAtUtc);
    }

    [Fact]
    public async Task GetAsync_returns_not_found_for_another_users_habit()
    {
        using HabitServiceHarness harness = HabitServiceHarness.Create();
        Guid firstUserId = await harness.AddUserAsync("first@example.com");
        Guid secondUserId = await harness.AddUserAsync("second@example.com");
        HabitResponse created = await harness.CreateHabitAsync(firstUserId, "Private habit");

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.GetAsync(
                harness.CreatePrincipal(secondUserId),
                created.Id,
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status404NotFound, exception.StatusCode);
    }

    [Fact]
    public async Task UpdateAsync_returns_not_found_for_another_users_habit()
    {
        using HabitServiceHarness harness = HabitServiceHarness.Create();
        Guid firstUserId = await harness.AddUserAsync("first@example.com");
        Guid secondUserId = await harness.AddUserAsync("second@example.com");
        HabitResponse created = await harness.CreateHabitAsync(firstUserId, "Private habit");

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.UpdateAsync(
                harness.CreatePrincipal(secondUserId),
                created.Id,
                new UpdateHabitRequest(
                    Title: "Stolen title",
                    Description: "Should not save.",
                    Category: "Learning",
                    Difficulty: "Hard",
                    Frequency: "Weekly"),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status404NotFound, exception.StatusCode);

        Habit storedHabit = await harness.DbContext.Habits.SingleAsync(
            habit => habit.Id == created.Id);
        Assert.Equal("Private habit", storedHabit.Title);
    }

    [Fact]
    public async Task ArchiveAsync_marks_habit_archived_and_hides_it_from_default_list()
    {
        using HabitServiceHarness harness = HabitServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        HabitResponse created = await harness.CreateHabitAsync(userId, "Archive me");

        await harness.Service.ArchiveAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        Habit storedHabit = await harness.DbContext.Habits.SingleAsync();
        Assert.True(storedHabit.IsArchived);

        IReadOnlyList<HabitResponse> activeHabits = await harness.Service.ListAsync(
            harness.CreatePrincipal(userId),
            includeArchived: false,
            CancellationToken.None);
        Assert.Empty(activeHabits);

        IReadOnlyList<HabitResponse> allHabits = await harness.Service.ListAsync(
            harness.CreatePrincipal(userId),
            includeArchived: true,
            CancellationToken.None);
        HabitResponse archivedHabit = Assert.Single(allHabits);
        Assert.True(archivedHabit.IsArchived);
    }

    [Fact]
    public async Task ArchiveAsync_returns_not_found_for_another_users_habit()
    {
        using HabitServiceHarness harness = HabitServiceHarness.Create();
        Guid firstUserId = await harness.AddUserAsync("first@example.com");
        Guid secondUserId = await harness.AddUserAsync("second@example.com");
        HabitResponse created = await harness.CreateHabitAsync(firstUserId, "Private habit");

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.ArchiveAsync(
                harness.CreatePrincipal(secondUserId),
                created.Id,
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status404NotFound, exception.StatusCode);

        Habit storedHabit = await harness.DbContext.Habits.SingleAsync(
            habit => habit.Id == created.Id);
        Assert.False(storedHabit.IsArchived);
    }

    [Fact]
    public async Task CompleteTodayAsync_completes_the_authenticated_users_active_habit()
    {
        using HabitServiceHarness harness = HabitServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        HabitResponse created = await harness.CreateHabitAsync(userId, "Complete me");

        HabitCompletionResponse completion = await harness.Service.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        Assert.NotEqual(Guid.Empty, completion.Id);
        Assert.Equal(userId, completion.UserId);
        Assert.Equal(created.Id, completion.HabitId);
        Assert.Equal(new DateOnly(2026, 6, 18), completion.CompletionDateUtc);
        Assert.Equal(harness.Time.GetUtcNow(), completion.CompletedAtUtc);
        Assert.Equal(10, completion.XpAwarded);
        Assert.False(completion.WasAlreadyCompleted);
        Assert.Equal(1, completion.Habit.CurrentStreak);
        Assert.Equal(1, completion.Habit.BestStreak);
        Assert.Equal(new DateOnly(2026, 6, 18), completion.Habit.LastCompletedDateUtc);
        Assert.Equal(completion.CompletedAtUtc, completion.Habit.LastCompletedAtUtc);

        HabitCompletion storedCompletion = await harness.DbContext.HabitCompletions.SingleAsync();
        Assert.Equal(completion.Id, storedCompletion.Id);
        Assert.Equal(created.Id, storedCompletion.HabitId);
        Assert.Equal(userId, storedCompletion.UserId);
        Assert.Equal(10, storedCompletion.XpAwarded);

        HabitResponse loadedHabit = await harness.Service.GetAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        Assert.True(loadedHabit.CompletedToday);
        Assert.Equal(10, loadedHabit.CompletedTodayXpAwarded);
        Assert.Equal(completion.CompletedAtUtc, loadedHabit.CompletedTodayAtUtc);
        Assert.Equal(completion.Habit.CurrentStreak, loadedHabit.CurrentStreak);
        Assert.Equal(completion.Habit.BestStreak, loadedHabit.BestStreak);
    }

    [Fact]
    public async Task CompleteTodayAsync_increases_habit_streak_for_consecutive_completion_days()
    {
        using HabitServiceHarness harness = HabitServiceHarness.Create();
        harness.Time.SetUtcNow(new DateTimeOffset(2026, 6, 16, 12, 0, 0, TimeSpan.Zero));
        Guid userId = await harness.AddUserAsync("player@example.com");
        HabitResponse created = await harness.CreateHabitAsync(userId, "Daily practice");

        await harness.Service.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        harness.Time.SetUtcNow(new DateTimeOffset(2026, 6, 17, 12, 0, 0, TimeSpan.Zero));
        await harness.Service.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        harness.Time.SetUtcNow(new DateTimeOffset(2026, 6, 18, 12, 0, 0, TimeSpan.Zero));
        HabitCompletionResponse completion = await harness.Service.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        Assert.Equal(3, completion.Habit.CurrentStreak);
        Assert.Equal(3, completion.Habit.BestStreak);
        Assert.Equal(new DateOnly(2026, 6, 18), completion.Habit.LastCompletedDateUtc);
    }

    [Fact]
    public async Task GetAsync_keeps_yesterday_streak_active_and_resets_after_missed_day()
    {
        using HabitServiceHarness harness = HabitServiceHarness.Create();
        harness.Time.SetUtcNow(new DateTimeOffset(2026, 6, 16, 12, 0, 0, TimeSpan.Zero));
        Guid userId = await harness.AddUserAsync("player@example.com");
        HabitResponse created = await harness.CreateHabitAsync(userId, "Daily reading");

        await harness.Service.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        harness.Time.SetUtcNow(new DateTimeOffset(2026, 6, 17, 12, 0, 0, TimeSpan.Zero));
        await harness.Service.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        harness.Time.SetUtcNow(new DateTimeOffset(2026, 6, 18, 12, 0, 0, TimeSpan.Zero));
        HabitResponse activeStreak = await harness.Service.GetAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        Assert.False(activeStreak.CompletedToday);
        Assert.Equal(2, activeStreak.CurrentStreak);
        Assert.Equal(2, activeStreak.BestStreak);
        Assert.Equal(new DateOnly(2026, 6, 17), activeStreak.LastCompletedDateUtc);

        harness.Time.SetUtcNow(new DateTimeOffset(2026, 6, 19, 12, 0, 0, TimeSpan.Zero));
        HabitResponse resetStreak = await harness.Service.GetAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        Assert.Equal(0, resetStreak.CurrentStreak);
        Assert.Equal(2, resetStreak.BestStreak);
    }

    [Theory]
    [InlineData("Easy", 10)]
    [InlineData("Medium", 20)]
    [InlineData("Hard", 35)]
    public async Task CompleteTodayAsync_awards_expected_xp_for_difficulty(
        string difficulty,
        int expectedXp)
    {
        using HabitServiceHarness harness = HabitServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        HabitResponse created = await harness.CreateHabitAsync(
            userId,
            $"{difficulty} habit",
            difficulty);

        HabitCompletionResponse completion = await harness.Service.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        Assert.Equal(expectedXp, completion.XpAwarded);
        Assert.Equal(expectedXp, completion.ProgressProfile.TotalXp);
        Assert.Equal(1, completion.ProgressProfile.Level);
        Assert.Equal(expectedXp, completion.ProgressProfile.XpInCurrentLevel);
        Assert.Equal(100 - expectedXp, completion.ProgressProfile.XpToNextLevel);

        ProgressProfile storedProfile = await harness.DbContext.ProgressProfiles.SingleAsync();
        Assert.Equal(expectedXp, storedProfile.TotalXp);
        Assert.Equal(1, storedProfile.Level);
    }

    [Fact]
    public async Task CompleteTodayAsync_updates_the_authenticated_users_progress_profile()
    {
        using HabitServiceHarness harness = HabitServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        HabitResponse created = await harness.CreateHabitAsync(
            userId,
            "Focused practice",
            difficulty: "Hard");

        HabitCompletionResponse completion = await harness.Service.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        Assert.Equal(35, completion.ProgressProfile.TotalXp);
        Assert.Equal(35, completion.ProgressProfile.XpInCurrentLevel);
        Assert.Equal(65, completion.ProgressProfile.XpToNextLevel);

        ProgressProfile storedProfile = await harness.DbContext.ProgressProfiles.SingleAsync();
        Assert.Equal(35, storedProfile.TotalXp);
        Assert.Equal(1, storedProfile.Level);
    }

    [Fact]
    public async Task CompleteTodayAsync_increases_level_when_total_xp_reaches_threshold()
    {
        using HabitServiceHarness harness = HabitServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        await harness.SetProgressXpAsync(userId, totalXp: 90);
        HabitResponse created = await harness.CreateHabitAsync(
            userId,
            "Level break",
            difficulty: "Easy");

        HabitCompletionResponse completion = await harness.Service.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        Assert.Equal(100, completion.ProgressProfile.TotalXp);
        Assert.Equal(2, completion.ProgressProfile.Level);
        Assert.Equal(0, completion.ProgressProfile.XpInCurrentLevel);
        Assert.Equal(200, completion.ProgressProfile.XpRequiredForNextLevel);
        Assert.Equal(200, completion.ProgressProfile.XpToNextLevel);

        ProgressProfile storedProfile = await harness.DbContext.ProgressProfiles.SingleAsync();
        Assert.Equal(2, storedProfile.Level);
    }

    [Fact]
    public async Task CompleteTodayAsync_returns_existing_completion_for_duplicate_same_day()
    {
        using HabitServiceHarness harness = HabitServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        HabitResponse created = await harness.CreateHabitAsync(userId, "Only once");

        HabitCompletionResponse firstCompletion = await harness.Service.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        harness.Time.Advance(TimeSpan.FromHours(2));

        HabitCompletionResponse duplicateCompletion = await harness.Service.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        Assert.Equal(firstCompletion.Id, duplicateCompletion.Id);
        Assert.Equal(firstCompletion.CompletedAtUtc, duplicateCompletion.CompletedAtUtc);
        Assert.Equal(10, duplicateCompletion.XpAwarded);
        Assert.True(duplicateCompletion.WasAlreadyCompleted);
        Assert.Equal(1, duplicateCompletion.Habit.CurrentStreak);
        Assert.Equal(1, duplicateCompletion.Habit.BestStreak);
        Assert.Equal(1, await harness.DbContext.HabitCompletions.CountAsync());

        ProgressProfile storedProfile = await harness.DbContext.ProgressProfiles.SingleAsync();
        Assert.Equal(10, storedProfile.TotalXp);
        Assert.Equal(1, storedProfile.Level);
    }

    [Fact]
    public async Task GetAsync_uses_only_the_authenticated_users_completions_for_streaks()
    {
        using HabitServiceHarness harness = HabitServiceHarness.Create();
        Guid firstUserId = await harness.AddUserAsync("first@example.com");
        Guid secondUserId = await harness.AddUserAsync("second@example.com");
        HabitResponse created = await harness.CreateHabitAsync(firstUserId, "Private streak");

        harness.DbContext.HabitCompletions.Add(new HabitCompletion
        {
            UserId = secondUserId,
            HabitId = created.Id,
            CompletionDateUtc = new DateOnly(2026, 6, 18),
            CompletedAtUtc = harness.Time.GetUtcNow(),
            XpAwarded = 35
        });
        await harness.DbContext.SaveChangesAsync();

        HabitResponse firstUserHabit = await harness.Service.GetAsync(
            harness.CreatePrincipal(firstUserId),
            created.Id,
            CancellationToken.None);

        Assert.False(firstUserHabit.CompletedToday);
        Assert.Equal(0, firstUserHabit.CurrentStreak);
        Assert.Equal(0, firstUserHabit.BestStreak);
    }

    [Fact]
    public async Task CompleteTodayAsync_returns_not_found_for_another_users_habit()
    {
        using HabitServiceHarness harness = HabitServiceHarness.Create();
        Guid firstUserId = await harness.AddUserAsync("first@example.com");
        Guid secondUserId = await harness.AddUserAsync("second@example.com");
        HabitResponse created = await harness.CreateHabitAsync(firstUserId, "Private habit");

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.CompleteTodayAsync(
                harness.CreatePrincipal(secondUserId),
                created.Id,
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status404NotFound, exception.StatusCode);
        Assert.Empty(harness.DbContext.HabitCompletions);

        ProgressProfile secondUserProfile = await harness.DbContext.ProgressProfiles
            .SingleAsync(profile => profile.UserId == secondUserId);
        Assert.Equal(0, secondUserProfile.TotalXp);
    }

    [Fact]
    public async Task CompleteTodayAsync_returns_not_found_for_archived_habit()
    {
        using HabitServiceHarness harness = HabitServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        HabitResponse created = await harness.CreateHabitAsync(userId, "Archived habit");

        await harness.Service.ArchiveAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.CompleteTodayAsync(
                harness.CreatePrincipal(userId),
                created.Id,
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status404NotFound, exception.StatusCode);
        Assert.Empty(harness.DbContext.HabitCompletions);

        ProgressProfile storedProfile = await harness.DbContext.ProgressProfiles.SingleAsync();
        Assert.Equal(0, storedProfile.TotalXp);
    }

    [Fact]
    public async Task CompleteTodayAsync_does_not_add_streak_progress_to_archived_habit()
    {
        using HabitServiceHarness harness = HabitServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        HabitResponse created = await harness.CreateHabitAsync(userId, "Archived streak");

        HabitCompletionResponse firstCompletion = await harness.Service.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        await harness.Service.ArchiveAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        harness.Time.Advance(TimeSpan.FromDays(1));

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.CompleteTodayAsync(
                harness.CreatePrincipal(userId),
                created.Id,
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status404NotFound, exception.StatusCode);
        Assert.Equal(1, await harness.DbContext.HabitCompletions.CountAsync());

        HabitResponse archivedHabit = await harness.Service.GetAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        Assert.Equal(firstCompletion.Habit.CurrentStreak, archivedHabit.CurrentStreak);
        Assert.Equal(firstCompletion.Habit.BestStreak, archivedHabit.BestStreak);
    }

    [Fact]
    public async Task ListAsync_without_authenticated_user_is_rejected()
    {
        using HabitServiceHarness harness = HabitServiceHarness.Create();
        ClaimsPrincipal unauthenticatedUser = new(new ClaimsIdentity());

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.ListAsync(
                unauthenticatedUser,
                includeArchived: false,
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status401Unauthorized, exception.StatusCode);
    }

    [Fact]
    public async Task CompleteTodayAsync_without_authenticated_user_is_rejected()
    {
        using HabitServiceHarness harness = HabitServiceHarness.Create();
        ClaimsPrincipal unauthenticatedUser = new(new ClaimsIdentity());

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.CompleteTodayAsync(
                unauthenticatedUser,
                Guid.NewGuid(),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status401Unauthorized, exception.StatusCode);
    }

    private sealed class HabitServiceHarness : IDisposable
    {
        private HabitServiceHarness(
            LevelHabitDbContext dbContext,
            IHabitService service,
            TestTimeProvider time)
        {
            DbContext = dbContext;
            Service = service;
            Time = time;
        }

        public LevelHabitDbContext DbContext { get; }

        public IHabitService Service { get; }

        public TestTimeProvider Time { get; }

        public static HabitServiceHarness Create()
        {
            DbContextOptions<LevelHabitDbContext> options = new DbContextOptionsBuilder<LevelHabitDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;

            LevelHabitDbContext dbContext = new(options);
            TestTimeProvider time = new(new DateTimeOffset(2026, 6, 18, 12, 0, 0, TimeSpan.Zero));
            AchievementService achievementService = new(dbContext, time);
            HabitService service = new(dbContext, time, achievementService);

            return new HabitServiceHarness(dbContext, service, time);
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

        public Task SetProgressXpAsync(Guid userId, int totalXp)
        {
            ProgressProfile progressProfile = DbContext.ProgressProfiles.Single(
                profile => profile.UserId == userId);

            progressProfile.TotalXp = totalXp;
            progressProfile.Level = 1;
            progressProfile.UpdatedAtUtc = Time.GetUtcNow();

            return DbContext.SaveChangesAsync();
        }

        public Task<HabitResponse> CreateHabitAsync(
            Guid userId,
            string title,
            string difficulty = "Easy")
        {
            return Service.CreateAsync(
                CreatePrincipal(userId),
                new CreateHabitRequest(
                    Title: title,
                    Description: "Test habit",
                    Category: "Health",
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

        public void Advance(TimeSpan duration)
        {
            currentUtc = currentUtc.Add(duration);
        }

        public void SetUtcNow(DateTimeOffset timestamp)
        {
            currentUtc = timestamp.ToUniversalTime();
        }
    }
}
