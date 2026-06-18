using System.Security.Claims;
using LevelHabit.Api.Contracts.Quests;
using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using LevelHabit.Api.Middleware;
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
            QuestService service = new(dbContext, time);

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

            await DbContext.SaveChangesAsync();

            return userId;
        }

        public Task<QuestResponse> CreateQuestAsync(Guid userId, string title)
        {
            return Service.CreateAsync(
                CreatePrincipal(userId),
                new CreateQuestRequest(
                    Title: title,
                    Description: "Test quest",
                    Category: "Health",
                    Difficulty: "Easy",
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
    }
}
