using System.Security.Claims;
using LevelHabit.Api.Contracts.Quests;
using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using LevelHabit.Api.Middleware;
using LevelHabit.Api.Services.Achievements;
using LevelHabit.Api.Services.Quests;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace LevelHabit.Api.Tests;

public sealed class QuestServiceTests
{
    [Fact]
    public async Task CreateAsync_creates_quest_for_authenticated_user()
    {
        using QuestServiceHarness harness = QuestServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");

        QuestResponse quest = await harness.Service.CreateAsync(
            harness.CreatePrincipal(userId),
            new CreateQuestRequest(
                Title: " Morning training ",
                Description: " Move before work. ",
                Category: "fitness",
                Difficulty: "medium",
                Frequency: "daily"),
            CancellationToken.None);

        Assert.NotEqual(Guid.Empty, quest.Id);
        Assert.Equal(userId, quest.UserId);
        Assert.Equal("Morning training", quest.Title);
        Assert.Equal("Move before work.", quest.Description);
        Assert.Equal("Fitness", quest.Category);
        Assert.Equal("Medium", quest.Difficulty);
        Assert.Equal("Daily", quest.Frequency);
        Assert.False(quest.IsArchived);

        Quest storedQuest = await harness.DbContext.Quests.SingleAsync();
        Assert.Equal(userId, storedQuest.UserId);
    }

    [Fact]
    public async Task ListAsync_returns_only_the_authenticated_users_active_quests()
    {
        using QuestServiceHarness harness = QuestServiceHarness.Create();
        Guid firstUserId = await harness.AddUserAsync("first@example.com");
        Guid secondUserId = await harness.AddUserAsync("second@example.com");

        QuestResponse ownActiveQuest = await harness.CreateQuestAsync(firstUserId, "Own active");
        await harness.CreateQuestAsync(secondUserId, "Other user active");
        QuestResponse archivedQuest = await harness.CreateQuestAsync(firstUserId, "Own archived");
        await harness.Service.ArchiveAsync(
            harness.CreatePrincipal(firstUserId),
            archivedQuest.Id,
            CancellationToken.None);

        IReadOnlyList<QuestResponse> quests = await harness.Service.ListAsync(
            harness.CreatePrincipal(firstUserId),
            includeArchived: false,
            CancellationToken.None);

        QuestResponse quest = Assert.Single(quests);
        Assert.Equal(ownActiveQuest.Id, quest.Id);
    }

    [Fact]
    public async Task UpdateAsync_updates_the_authenticated_users_quest()
    {
        using QuestServiceHarness harness = QuestServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        QuestResponse created = await harness.CreateQuestAsync(userId, "Original title");

        harness.Time.Advance(TimeSpan.FromMinutes(5));

        QuestResponse updated = await harness.Service.UpdateAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            new UpdateQuestRequest(
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
    public async Task GetAsync_returns_not_found_for_another_users_quest()
    {
        using QuestServiceHarness harness = QuestServiceHarness.Create();
        Guid firstUserId = await harness.AddUserAsync("first@example.com");
        Guid secondUserId = await harness.AddUserAsync("second@example.com");
        QuestResponse created = await harness.CreateQuestAsync(firstUserId, "Private quest");

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.GetAsync(
                harness.CreatePrincipal(secondUserId),
                created.Id,
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status404NotFound, exception.StatusCode);
    }

    [Fact]
    public async Task ArchiveAsync_marks_quest_archived_and_hides_it_from_default_list()
    {
        using QuestServiceHarness harness = QuestServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        QuestResponse created = await harness.CreateQuestAsync(userId, "Archive me");

        await harness.Service.ArchiveAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        Quest storedQuest = await harness.DbContext.Quests.SingleAsync();
        Assert.True(storedQuest.IsArchived);

        IReadOnlyList<QuestResponse> activeQuests = await harness.Service.ListAsync(
            harness.CreatePrincipal(userId),
            includeArchived: false,
            CancellationToken.None);
        Assert.Empty(activeQuests);

        IReadOnlyList<QuestResponse> allQuests = await harness.Service.ListAsync(
            harness.CreatePrincipal(userId),
            includeArchived: true,
            CancellationToken.None);
        QuestResponse archivedQuest = Assert.Single(allQuests);
        Assert.True(archivedQuest.IsArchived);
    }

    [Fact]
    public async Task CompleteTodayAsync_completes_the_authenticated_users_active_quest()
    {
        using QuestServiceHarness harness = QuestServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        QuestResponse created = await harness.CreateQuestAsync(userId, "Complete me");

        QuestCompletionResponse completion = await harness.Service.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        Assert.NotEqual(Guid.Empty, completion.Id);
        Assert.Equal(userId, completion.UserId);
        Assert.Equal(created.Id, completion.QuestId);
        Assert.Equal(new DateOnly(2026, 6, 18), completion.CompletionDateUtc);
        Assert.Equal(harness.Time.GetUtcNow(), completion.CompletedAtUtc);
        Assert.Equal(10, completion.XpAwarded);
        Assert.False(completion.WasAlreadyCompleted);
        Assert.Equal(1, completion.Quest.CurrentStreak);
        Assert.Equal(1, completion.Quest.BestStreak);
        Assert.Equal(new DateOnly(2026, 6, 18), completion.Quest.LastCompletedDateUtc);
        Assert.Equal(completion.CompletedAtUtc, completion.Quest.LastCompletedAtUtc);

        QuestCompletion storedCompletion = await harness.DbContext.QuestCompletions.SingleAsync();
        Assert.Equal(completion.Id, storedCompletion.Id);
        Assert.Equal(created.Id, storedCompletion.QuestId);
        Assert.Equal(userId, storedCompletion.UserId);
        Assert.Equal(10, storedCompletion.XpAwarded);

        QuestResponse loadedQuest = await harness.Service.GetAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        Assert.True(loadedQuest.CompletedToday);
        Assert.Equal(10, loadedQuest.CompletedTodayXpAwarded);
        Assert.Equal(completion.CompletedAtUtc, loadedQuest.CompletedTodayAtUtc);
        Assert.Equal(completion.Quest.CurrentStreak, loadedQuest.CurrentStreak);
        Assert.Equal(completion.Quest.BestStreak, loadedQuest.BestStreak);
    }

    [Fact]
    public async Task CompleteTodayAsync_increases_quest_streak_for_consecutive_completion_days()
    {
        using QuestServiceHarness harness = QuestServiceHarness.Create();
        harness.Time.SetUtcNow(new DateTimeOffset(2026, 6, 16, 12, 0, 0, TimeSpan.Zero));
        Guid userId = await harness.AddUserAsync("player@example.com");
        QuestResponse created = await harness.CreateQuestAsync(userId, "Daily practice");

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
        QuestCompletionResponse completion = await harness.Service.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        Assert.Equal(3, completion.Quest.CurrentStreak);
        Assert.Equal(3, completion.Quest.BestStreak);
        Assert.Equal(new DateOnly(2026, 6, 18), completion.Quest.LastCompletedDateUtc);
    }

    [Fact]
    public async Task GetAsync_keeps_yesterday_streak_active_and_resets_after_missed_day()
    {
        using QuestServiceHarness harness = QuestServiceHarness.Create();
        harness.Time.SetUtcNow(new DateTimeOffset(2026, 6, 16, 12, 0, 0, TimeSpan.Zero));
        Guid userId = await harness.AddUserAsync("player@example.com");
        QuestResponse created = await harness.CreateQuestAsync(userId, "Daily reading");

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
        QuestResponse activeStreak = await harness.Service.GetAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        Assert.False(activeStreak.CompletedToday);
        Assert.Equal(2, activeStreak.CurrentStreak);
        Assert.Equal(2, activeStreak.BestStreak);
        Assert.Equal(new DateOnly(2026, 6, 17), activeStreak.LastCompletedDateUtc);

        harness.Time.SetUtcNow(new DateTimeOffset(2026, 6, 19, 12, 0, 0, TimeSpan.Zero));
        QuestResponse resetStreak = await harness.Service.GetAsync(
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
        using QuestServiceHarness harness = QuestServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        QuestResponse created = await harness.CreateQuestAsync(
            userId,
            $"{difficulty} quest",
            difficulty);

        QuestCompletionResponse completion = await harness.Service.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        Assert.Equal(expectedXp, completion.XpAwarded);
        Assert.Equal(expectedXp, completion.HeroProfile.TotalXp);
        Assert.Equal(1, completion.HeroProfile.Level);
        Assert.Equal(expectedXp, completion.HeroProfile.XpInCurrentLevel);
        Assert.Equal(100 - expectedXp, completion.HeroProfile.XpToNextLevel);

        HeroProfile storedProfile = await harness.DbContext.HeroProfiles.SingleAsync();
        Assert.Equal(expectedXp, storedProfile.TotalXp);
        Assert.Equal(1, storedProfile.Level);
    }

    [Fact]
    public async Task CompleteTodayAsync_updates_the_authenticated_users_hero_profile()
    {
        using QuestServiceHarness harness = QuestServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        QuestResponse created = await harness.CreateQuestAsync(
            userId,
            "Focused practice",
            difficulty: "Hard");

        QuestCompletionResponse completion = await harness.Service.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        Assert.Equal(35, completion.HeroProfile.TotalXp);
        Assert.Equal(35, completion.HeroProfile.XpInCurrentLevel);
        Assert.Equal(65, completion.HeroProfile.XpToNextLevel);

        HeroProfile storedProfile = await harness.DbContext.HeroProfiles.SingleAsync();
        Assert.Equal(35, storedProfile.TotalXp);
        Assert.Equal(1, storedProfile.Level);
    }

    [Fact]
    public async Task CompleteTodayAsync_increases_level_when_total_xp_reaches_threshold()
    {
        using QuestServiceHarness harness = QuestServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        await harness.SetHeroXpAsync(userId, totalXp: 90);
        QuestResponse created = await harness.CreateQuestAsync(
            userId,
            "Level break",
            difficulty: "Easy");

        QuestCompletionResponse completion = await harness.Service.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        Assert.Equal(100, completion.HeroProfile.TotalXp);
        Assert.Equal(2, completion.HeroProfile.Level);
        Assert.Equal(0, completion.HeroProfile.XpInCurrentLevel);
        Assert.Equal(200, completion.HeroProfile.XpRequiredForNextLevel);
        Assert.Equal(200, completion.HeroProfile.XpToNextLevel);

        HeroProfile storedProfile = await harness.DbContext.HeroProfiles.SingleAsync();
        Assert.Equal(2, storedProfile.Level);
    }

    [Fact]
    public async Task CompleteTodayAsync_returns_existing_completion_for_duplicate_same_day()
    {
        using QuestServiceHarness harness = QuestServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        QuestResponse created = await harness.CreateQuestAsync(userId, "Only once");

        QuestCompletionResponse firstCompletion = await harness.Service.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        harness.Time.Advance(TimeSpan.FromHours(2));

        QuestCompletionResponse duplicateCompletion = await harness.Service.CompleteTodayAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        Assert.Equal(firstCompletion.Id, duplicateCompletion.Id);
        Assert.Equal(firstCompletion.CompletedAtUtc, duplicateCompletion.CompletedAtUtc);
        Assert.Equal(10, duplicateCompletion.XpAwarded);
        Assert.True(duplicateCompletion.WasAlreadyCompleted);
        Assert.Equal(1, duplicateCompletion.Quest.CurrentStreak);
        Assert.Equal(1, duplicateCompletion.Quest.BestStreak);
        Assert.Equal(1, await harness.DbContext.QuestCompletions.CountAsync());

        HeroProfile storedProfile = await harness.DbContext.HeroProfiles.SingleAsync();
        Assert.Equal(10, storedProfile.TotalXp);
        Assert.Equal(1, storedProfile.Level);
    }

    [Fact]
    public async Task GetAsync_uses_only_the_authenticated_users_completions_for_streaks()
    {
        using QuestServiceHarness harness = QuestServiceHarness.Create();
        Guid firstUserId = await harness.AddUserAsync("first@example.com");
        Guid secondUserId = await harness.AddUserAsync("second@example.com");
        QuestResponse created = await harness.CreateQuestAsync(firstUserId, "Private streak");

        harness.DbContext.QuestCompletions.Add(new QuestCompletion
        {
            UserId = secondUserId,
            QuestId = created.Id,
            CompletionDateUtc = new DateOnly(2026, 6, 18),
            CompletedAtUtc = harness.Time.GetUtcNow(),
            XpAwarded = 35
        });
        await harness.DbContext.SaveChangesAsync();

        QuestResponse firstUserQuest = await harness.Service.GetAsync(
            harness.CreatePrincipal(firstUserId),
            created.Id,
            CancellationToken.None);

        Assert.False(firstUserQuest.CompletedToday);
        Assert.Equal(0, firstUserQuest.CurrentStreak);
        Assert.Equal(0, firstUserQuest.BestStreak);
    }

    [Fact]
    public async Task CompleteTodayAsync_returns_not_found_for_another_users_quest()
    {
        using QuestServiceHarness harness = QuestServiceHarness.Create();
        Guid firstUserId = await harness.AddUserAsync("first@example.com");
        Guid secondUserId = await harness.AddUserAsync("second@example.com");
        QuestResponse created = await harness.CreateQuestAsync(firstUserId, "Private quest");

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.CompleteTodayAsync(
                harness.CreatePrincipal(secondUserId),
                created.Id,
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status404NotFound, exception.StatusCode);
        Assert.Empty(harness.DbContext.QuestCompletions);

        HeroProfile secondUserProfile = await harness.DbContext.HeroProfiles
            .SingleAsync(profile => profile.UserId == secondUserId);
        Assert.Equal(0, secondUserProfile.TotalXp);
    }

    [Fact]
    public async Task CompleteTodayAsync_returns_not_found_for_archived_quest()
    {
        using QuestServiceHarness harness = QuestServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        QuestResponse created = await harness.CreateQuestAsync(userId, "Archived quest");

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
        Assert.Empty(harness.DbContext.QuestCompletions);

        HeroProfile storedProfile = await harness.DbContext.HeroProfiles.SingleAsync();
        Assert.Equal(0, storedProfile.TotalXp);
    }

    [Fact]
    public async Task CompleteTodayAsync_does_not_add_streak_progress_to_archived_quest()
    {
        using QuestServiceHarness harness = QuestServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        QuestResponse created = await harness.CreateQuestAsync(userId, "Archived streak");

        QuestCompletionResponse firstCompletion = await harness.Service.CompleteTodayAsync(
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
        Assert.Equal(1, await harness.DbContext.QuestCompletions.CountAsync());

        QuestResponse archivedQuest = await harness.Service.GetAsync(
            harness.CreatePrincipal(userId),
            created.Id,
            CancellationToken.None);

        Assert.Equal(firstCompletion.Quest.CurrentStreak, archivedQuest.CurrentStreak);
        Assert.Equal(firstCompletion.Quest.BestStreak, archivedQuest.BestStreak);
    }

    [Fact]
    public async Task ListAsync_without_authenticated_user_is_rejected()
    {
        using QuestServiceHarness harness = QuestServiceHarness.Create();
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
        using QuestServiceHarness harness = QuestServiceHarness.Create();
        ClaimsPrincipal unauthenticatedUser = new(new ClaimsIdentity());

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.CompleteTodayAsync(
                unauthenticatedUser,
                Guid.NewGuid(),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status401Unauthorized, exception.StatusCode);
    }

    private sealed class QuestServiceHarness : IDisposable
    {
        private QuestServiceHarness(
            LevelHabitDbContext dbContext,
            IQuestService service,
            TestTimeProvider time)
        {
            DbContext = dbContext;
            Service = service;
            Time = time;
        }

        public LevelHabitDbContext DbContext { get; }

        public IQuestService Service { get; }

        public TestTimeProvider Time { get; }

        public static QuestServiceHarness Create()
        {
            DbContextOptions<LevelHabitDbContext> options = new DbContextOptionsBuilder<LevelHabitDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;

            LevelHabitDbContext dbContext = new(options);
            TestTimeProvider time = new(new DateTimeOffset(2026, 6, 18, 12, 0, 0, TimeSpan.Zero));
            AchievementService achievementService = new(dbContext, time);
            QuestService service = new(dbContext, time, achievementService);

            return new QuestServiceHarness(dbContext, service, time);
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

            DbContext.HeroProfiles.Add(new HeroProfile
            {
                UserId = userId,
                HeroName = "Test Hero",
                Level = 1,
                TotalXp = 0,
                CurrentStreak = 0,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            });

            await DbContext.SaveChangesAsync();

            return userId;
        }

        public Task SetHeroXpAsync(Guid userId, int totalXp)
        {
            HeroProfile heroProfile = DbContext.HeroProfiles.Single(
                profile => profile.UserId == userId);

            heroProfile.TotalXp = totalXp;
            heroProfile.Level = 1;
            heroProfile.UpdatedAtUtc = Time.GetUtcNow();

            return DbContext.SaveChangesAsync();
        }

        public Task<QuestResponse> CreateQuestAsync(
            Guid userId,
            string title,
            string difficulty = "Easy")
        {
            return Service.CreateAsync(
                CreatePrincipal(userId),
                new CreateQuestRequest(
                    Title: title,
                    Description: "Test quest",
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
