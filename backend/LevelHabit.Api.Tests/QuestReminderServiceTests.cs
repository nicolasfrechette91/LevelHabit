using System.Security.Claims;
using LevelHabit.Api.Contracts.Reminders;
using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using LevelHabit.Api.Middleware;
using LevelHabit.Api.Services.Reminders;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace LevelHabit.Api.Tests;

public sealed class QuestReminderServiceTests
{
    [Fact]
    public async Task UpsertAsync_creates_and_updates_a_reminder_for_the_authenticated_users_quest()
    {
        using QuestReminderServiceHarness harness = QuestReminderServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        Guid questId = await harness.AddQuestAsync(userId, "Morning training");

        QuestReminderResponse created = await harness.Service.UpsertAsync(
            harness.CreatePrincipal(userId),
            questId,
            new UpsertQuestReminderRequest(
                IsEnabled: true,
                Time: "08:30",
                TimeZoneId: "America/Toronto",
                DaysOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]),
            CancellationToken.None);

        Assert.NotNull(created.Id);
        Assert.True(created.IsEnabled);
        Assert.Equal("08:30", created.Time);
        Assert.Equal("America/Toronto", created.TimeZoneId);
        Assert.Equal(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], created.DaysOfWeek);
        Assert.NotNull(created.NextTriggerAtUtc);

        QuestReminderResponse updated = await harness.Service.UpsertAsync(
            harness.CreatePrincipal(userId),
            questId,
            new UpsertQuestReminderRequest(
                IsEnabled: true,
                Time: "09:15",
                TimeZoneId: "America/Toronto",
                DaysOfWeek: ["Wednesday"]),
            CancellationToken.None);

        Assert.Equal(created.Id, updated.Id);
        Assert.Equal("09:15", updated.Time);
        Assert.Equal(["Wednesday"], updated.DaysOfWeek);
        Assert.Equal(1, await harness.DbContext.QuestReminders.CountAsync());
    }

    [Fact]
    public async Task UpsertAsync_disables_and_DeleteAsync_deletes_a_reminder()
    {
        using QuestReminderServiceHarness harness = QuestReminderServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        Guid questId = await harness.AddQuestAsync(userId, "Evening study");

        await harness.Service.UpsertAsync(
            harness.CreatePrincipal(userId),
            questId,
            new UpsertQuestReminderRequest(
                IsEnabled: true,
                Time: "18:00",
                TimeZoneId: "America/Toronto",
                DaysOfWeek: ["Monday"]),
            CancellationToken.None);

        QuestReminderResponse disabled = await harness.Service.UpsertAsync(
            harness.CreatePrincipal(userId),
            questId,
            new UpsertQuestReminderRequest(
                IsEnabled: false,
                Time: null,
                TimeZoneId: null,
                DaysOfWeek: null),
            CancellationToken.None);

        Assert.False(disabled.IsEnabled);
        Assert.Null(disabled.NextTriggerAtUtc);

        await harness.Service.DeleteAsync(
            harness.CreatePrincipal(userId),
            questId,
            CancellationToken.None);

        Assert.Empty(harness.DbContext.QuestReminders);
    }

    [Fact]
    public async Task UpsertAsync_returns_not_found_for_another_users_quest()
    {
        using QuestReminderServiceHarness harness = QuestReminderServiceHarness.Create();
        Guid firstUserId = await harness.AddUserAsync("first@example.com");
        Guid secondUserId = await harness.AddUserAsync("second@example.com");
        Guid questId = await harness.AddQuestAsync(firstUserId, "Private quest");

        ApiException exception = await Assert.ThrowsAnyAsync<ApiException>(() =>
            harness.Service.UpsertAsync(
                harness.CreatePrincipal(secondUserId),
                questId,
                new UpsertQuestReminderRequest(
                    IsEnabled: true,
                    Time: "08:30",
                    TimeZoneId: "America/Toronto",
                    DaysOfWeek: ["Monday"]),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status404NotFound, exception.StatusCode);
    }

    [Fact]
    public async Task UpsertAsync_rejects_invalid_reminder_times()
    {
        using QuestReminderServiceHarness harness = QuestReminderServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        Guid questId = await harness.AddQuestAsync(userId, "Bad time");

        ApiException exception = await Assert.ThrowsAnyAsync<ApiException>(() =>
            harness.Service.UpsertAsync(
                harness.CreatePrincipal(userId),
                questId,
                new UpsertQuestReminderRequest(
                    IsEnabled: true,
                    Time: "8:30",
                    TimeZoneId: "America/Toronto",
                    DaysOfWeek: ["Monday"]),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status400BadRequest, exception.StatusCode);
        Assert.Contains(nameof(UpsertQuestReminderRequest.Time), exception.Errors!.Keys);
    }

    [Fact]
    public async Task UpsertAsync_rejects_invalid_timezone_identifiers()
    {
        using QuestReminderServiceHarness harness = QuestReminderServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        Guid questId = await harness.AddQuestAsync(userId, "Bad timezone");

        ApiException exception = await Assert.ThrowsAnyAsync<ApiException>(() =>
            harness.Service.UpsertAsync(
                harness.CreatePrincipal(userId),
                questId,
                new UpsertQuestReminderRequest(
                    IsEnabled: true,
                    Time: "08:30",
                    TimeZoneId: "Eastern Standard Time",
                    DaysOfWeek: ["Monday"]),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status400BadRequest, exception.StatusCode);
        Assert.Contains(nameof(UpsertQuestReminderRequest.TimeZoneId), exception.Errors!.Keys);
    }

    [Fact]
    public async Task UpsertAsync_rejects_enabled_reminder_with_no_selected_days()
    {
        using QuestReminderServiceHarness harness = QuestReminderServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        Guid questId = await harness.AddQuestAsync(userId, "No days");

        ApiException exception = await Assert.ThrowsAnyAsync<ApiException>(() =>
            harness.Service.UpsertAsync(
                harness.CreatePrincipal(userId),
                questId,
                new UpsertQuestReminderRequest(
                    IsEnabled: true,
                    Time: "08:30",
                    TimeZoneId: "America/Toronto",
                    DaysOfWeek: []),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status400BadRequest, exception.StatusCode);
        Assert.Contains(nameof(UpsertQuestReminderRequest.DaysOfWeek), exception.Errors!.Keys);
    }

    [Fact]
    public async Task UpsertAsync_rejects_enabled_reminder_for_archived_quest()
    {
        using QuestReminderServiceHarness harness = QuestReminderServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        Guid questId = await harness.AddQuestAsync(userId, "Archived quest", isArchived: true);

        ApiException exception = await Assert.ThrowsAnyAsync<ApiException>(() =>
            harness.Service.UpsertAsync(
                harness.CreatePrincipal(userId),
                questId,
                new UpsertQuestReminderRequest(
                    IsEnabled: true,
                    Time: "08:30",
                    TimeZoneId: "America/Toronto",
                    DaysOfWeek: ["Monday"]),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status400BadRequest, exception.StatusCode);
    }

    private sealed class QuestReminderServiceHarness : IDisposable
    {
        private QuestReminderServiceHarness(
            LevelHabitDbContext dbContext,
            IQuestReminderService service,
            TestTimeProvider time)
        {
            DbContext = dbContext;
            Service = service;
            Time = time;
        }

        public LevelHabitDbContext DbContext { get; }

        public IQuestReminderService Service { get; }

        public TestTimeProvider Time { get; }

        public static QuestReminderServiceHarness Create()
        {
            DbContextOptions<LevelHabitDbContext> options =
                new DbContextOptionsBuilder<LevelHabitDbContext>()
                    .UseInMemoryDatabase(Guid.NewGuid().ToString())
                    .Options;
            LevelHabitDbContext dbContext = new(options);
            TestTimeProvider time = new(new DateTimeOffset(2026, 6, 18, 12, 0, 0, TimeSpan.Zero));
            QuestReminderService service = new(
                dbContext,
                time,
                new ReminderScheduleCalculator());

            return new QuestReminderServiceHarness(dbContext, service, time);
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

        public async Task<Guid> AddQuestAsync(
            Guid userId,
            string title,
            bool isArchived = false)
        {
            Quest quest = new()
            {
                UserId = userId,
                Title = title,
                Description = "Test quest",
                Category = "Health",
                Difficulty = "Easy",
                Frequency = "Daily",
                IsArchived = isArchived,
                CreatedAtUtc = Time.GetUtcNow(),
                UpdatedAtUtc = Time.GetUtcNow()
            };

            DbContext.Quests.Add(quest);
            await DbContext.SaveChangesAsync();

            return quest.Id;
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
