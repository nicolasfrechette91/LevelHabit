using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using LevelHabit.Api.Services.Reminders;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace LevelHabit.Api.Tests;

public sealed class QuestReminderProcessorTests
{
    [Fact]
    public async Task ProcessDueAsync_creates_a_due_quest_reminder_notification()
    {
        using QuestReminderProcessorHarness harness = QuestReminderProcessorHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        Guid questId = await harness.AddQuestAsync(userId, "Morning training");
        DateTimeOffset scheduledAtUtc = new(2026, 6, 18, 11, 30, 0, TimeSpan.Zero);
        Guid reminderId = await harness.AddReminderAsync(
            userId,
            questId,
            scheduledAtUtc);

        int createdCount = await harness.Processor.ProcessDueAsync(CancellationToken.None);

        Assert.Equal(1, createdCount);

        Notification notification = await harness.DbContext.Notifications.SingleAsync();
        Assert.Equal(userId, notification.UserId);
        Assert.Equal(questId, notification.QuestId);
        Assert.Equal(NotificationType.QuestReminder, notification.Type);
        Assert.False(notification.IsRead);
        Assert.Contains("Morning training", notification.Message, StringComparison.Ordinal);
        Assert.Contains(reminderId.ToString(), notification.DeduplicationKey, StringComparison.Ordinal);

        QuestReminder reminder = await harness.DbContext.QuestReminders.SingleAsync();
        Assert.Equal(scheduledAtUtc, reminder.LastTriggeredAtUtc);
        Assert.True(reminder.NextTriggerAtUtc > harness.Time.GetUtcNow());
    }

    [Fact]
    public async Task ProcessDueAsync_avoids_duplicate_notifications_for_the_same_occurrence()
    {
        using QuestReminderProcessorHarness harness = QuestReminderProcessorHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        Guid questId = await harness.AddQuestAsync(userId, "Morning training");
        DateTimeOffset scheduledAtUtc = new(2026, 6, 18, 11, 30, 0, TimeSpan.Zero);
        await harness.AddReminderAsync(userId, questId, scheduledAtUtc);

        await harness.Processor.ProcessDueAsync(CancellationToken.None);
        int secondCreatedCount = await harness.Processor.ProcessDueAsync(CancellationToken.None);

        Assert.Equal(0, secondCreatedCount);
        Assert.Equal(1, await harness.DbContext.Notifications.CountAsync());
    }

    [Fact]
    public async Task ProcessDueAsync_ignores_archived_quests_and_disables_the_reminder()
    {
        using QuestReminderProcessorHarness harness = QuestReminderProcessorHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        Guid questId = await harness.AddQuestAsync(
            userId,
            "Archived quest",
            isArchived: true);
        await harness.AddReminderAsync(
            userId,
            questId,
            new DateTimeOffset(2026, 6, 18, 11, 30, 0, TimeSpan.Zero));

        int createdCount = await harness.Processor.ProcessDueAsync(CancellationToken.None);

        Assert.Equal(0, createdCount);
        Assert.Empty(harness.DbContext.Notifications);

        QuestReminder reminder = await harness.DbContext.QuestReminders.SingleAsync();
        Assert.False(reminder.IsEnabled);
        Assert.Null(reminder.NextTriggerAtUtc);
    }

    private sealed class QuestReminderProcessorHarness : IDisposable
    {
        private QuestReminderProcessorHarness(
            LevelHabitDbContext dbContext,
            IQuestReminderProcessor processor,
            TestTimeProvider time)
        {
            DbContext = dbContext;
            Processor = processor;
            Time = time;
        }

        public LevelHabitDbContext DbContext { get; }

        public IQuestReminderProcessor Processor { get; }

        public TestTimeProvider Time { get; }

        public static QuestReminderProcessorHarness Create()
        {
            DbContextOptions<LevelHabitDbContext> options =
                new DbContextOptionsBuilder<LevelHabitDbContext>()
                    .UseInMemoryDatabase(Guid.NewGuid().ToString())
                    .Options;
            LevelHabitDbContext dbContext = new(options);
            TestTimeProvider time = new(new DateTimeOffset(2026, 6, 18, 12, 0, 0, TimeSpan.Zero));
            QuestReminderProcessor processor = new(
                dbContext,
                time,
                new ReminderScheduleCalculator(),
                NullLogger<QuestReminderProcessor>.Instance);

            return new QuestReminderProcessorHarness(dbContext, processor, time);
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

        public async Task<Guid> AddReminderAsync(
            Guid userId,
            Guid questId,
            DateTimeOffset nextTriggerAtUtc)
        {
            QuestReminder reminder = new()
            {
                UserId = userId,
                QuestId = questId,
                IsEnabled = true,
                TimeOfDay = new TimeOnly(8, 30),
                TimeZoneId = "America/Toronto",
                DaysOfWeek = ReminderDays.ToBitMask(
                [
                    DayOfWeek.Monday,
                    DayOfWeek.Tuesday,
                    DayOfWeek.Wednesday,
                    DayOfWeek.Thursday,
                    DayOfWeek.Friday,
                    DayOfWeek.Saturday,
                    DayOfWeek.Sunday
                ]),
                NextTriggerAtUtc = nextTriggerAtUtc,
                CreatedAtUtc = Time.GetUtcNow(),
                UpdatedAtUtc = Time.GetUtcNow()
            };

            DbContext.QuestReminders.Add(reminder);
            await DbContext.SaveChangesAsync();

            return reminder.Id;
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
