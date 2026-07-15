using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using LevelHabit.Api.Services.Reminders;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace LevelHabit.Api.Tests;

public sealed class HabitReminderProcessorTests
{
    [Fact]
    public async Task ProcessDueAsync_creates_a_due_habit_reminder_notification()
    {
        using HabitReminderProcessorHarness harness = HabitReminderProcessorHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        Guid habitId = await harness.AddHabitAsync(userId, "Morning training");
        DateTimeOffset scheduledAtUtc = new(2026, 6, 18, 11, 30, 0, TimeSpan.Zero);
        Guid reminderId = await harness.AddReminderAsync(
            userId,
            habitId,
            scheduledAtUtc);

        int createdCount = await harness.Processor.ProcessDueAsync(CancellationToken.None);

        Assert.Equal(1, createdCount);

        Notification notification = await harness.DbContext.Notifications.SingleAsync();
        Assert.Equal(userId, notification.UserId);
        Assert.Equal(habitId, notification.HabitId);
        Assert.Equal(NotificationType.HabitReminder, notification.Type);
        Assert.False(notification.IsRead);
        Assert.Contains("Morning training", notification.Message, StringComparison.Ordinal);
        Assert.Contains(reminderId.ToString(), notification.DeduplicationKey, StringComparison.Ordinal);

        HabitReminder reminder = await harness.DbContext.HabitReminders.SingleAsync();
        Assert.Equal(scheduledAtUtc, reminder.LastTriggeredAtUtc);
        Assert.True(reminder.NextTriggerAtUtc > harness.Time.GetUtcNow());
    }

    [Fact]
    public async Task ProcessDueAsync_avoids_duplicate_notifications_for_the_same_occurrence()
    {
        using HabitReminderProcessorHarness harness = HabitReminderProcessorHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        Guid habitId = await harness.AddHabitAsync(userId, "Morning training");
        DateTimeOffset scheduledAtUtc = new(2026, 6, 18, 11, 30, 0, TimeSpan.Zero);
        await harness.AddReminderAsync(userId, habitId, scheduledAtUtc);

        await harness.Processor.ProcessDueAsync(CancellationToken.None);
        int secondCreatedCount = await harness.Processor.ProcessDueAsync(CancellationToken.None);

        Assert.Equal(0, secondCreatedCount);
        Assert.Equal(1, await harness.DbContext.Notifications.CountAsync());
    }

    [Fact]
    public async Task ProcessDueAsync_ignores_archived_habits_and_disables_the_reminder()
    {
        using HabitReminderProcessorHarness harness = HabitReminderProcessorHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        Guid habitId = await harness.AddHabitAsync(
            userId,
            "Archived habit",
            isArchived: true);
        await harness.AddReminderAsync(
            userId,
            habitId,
            new DateTimeOffset(2026, 6, 18, 11, 30, 0, TimeSpan.Zero));

        int createdCount = await harness.Processor.ProcessDueAsync(CancellationToken.None);

        Assert.Equal(0, createdCount);
        Assert.Empty(harness.DbContext.Notifications);

        HabitReminder reminder = await harness.DbContext.HabitReminders.SingleAsync();
        Assert.False(reminder.IsEnabled);
        Assert.Null(reminder.NextTriggerAtUtc);
    }

    private sealed class HabitReminderProcessorHarness : IDisposable
    {
        private HabitReminderProcessorHarness(
            LevelHabitDbContext dbContext,
            IHabitReminderProcessor processor,
            TestTimeProvider time)
        {
            DbContext = dbContext;
            Processor = processor;
            Time = time;
        }

        public LevelHabitDbContext DbContext { get; }

        public IHabitReminderProcessor Processor { get; }

        public TestTimeProvider Time { get; }

        public static HabitReminderProcessorHarness Create()
        {
            DbContextOptions<LevelHabitDbContext> options =
                new DbContextOptionsBuilder<LevelHabitDbContext>()
                    .UseInMemoryDatabase(Guid.NewGuid().ToString())
                    .Options;
            LevelHabitDbContext dbContext = new(options);
            TestTimeProvider time = new(new DateTimeOffset(2026, 6, 18, 12, 0, 0, TimeSpan.Zero));
            HabitReminderProcessor processor = new(
                dbContext,
                time,
                new ReminderScheduleCalculator(),
                NullLogger<HabitReminderProcessor>.Instance);

            return new HabitReminderProcessorHarness(dbContext, processor, time);
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

        public async Task<Guid> AddHabitAsync(
            Guid userId,
            string title,
            bool isArchived = false)
        {
            Habit habit = new()
            {
                UserId = userId,
                Title = title,
                Description = "Test habit",
                Category = "Health",
                Difficulty = "Easy",
                Frequency = "Daily",
                IsArchived = isArchived,
                CreatedAtUtc = Time.GetUtcNow(),
                UpdatedAtUtc = Time.GetUtcNow()
            };

            DbContext.Habits.Add(habit);
            await DbContext.SaveChangesAsync();

            return habit.Id;
        }

        public async Task<Guid> AddReminderAsync(
            Guid userId,
            Guid habitId,
            DateTimeOffset nextTriggerAtUtc)
        {
            HabitReminder reminder = new()
            {
                UserId = userId,
                HabitId = habitId,
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

            DbContext.HabitReminders.Add(reminder);
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
