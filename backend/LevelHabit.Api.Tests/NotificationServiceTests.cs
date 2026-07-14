using System.Security.Claims;
using LevelHabit.Api.Contracts.Notifications;
using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using LevelHabit.Api.Middleware;
using LevelHabit.Api.Services.Notifications;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace LevelHabit.Api.Tests;

public sealed class NotificationServiceTests
{
    [Fact]
    public async Task ListAsync_returns_only_the_authenticated_users_notifications()
    {
        using NotificationServiceHarness harness = NotificationServiceHarness.Create();
        Guid firstUserId = await harness.AddUserAsync("first@example.com");
        Guid secondUserId = await harness.AddUserAsync("second@example.com");
        Notification ownNotification = await harness.AddNotificationAsync(
            firstUserId,
            "Own notification");
        await harness.AddNotificationAsync(secondUserId, "Other notification");

        NotificationListResponse response = await harness.Service.ListAsync(
            harness.CreatePrincipal(firstUserId),
            page: 1,
            pageSize: 20,
            unreadOnly: false,
            CancellationToken.None);

        NotificationResponse notification = Assert.Single(response.Items);
        Assert.Equal(ownNotification.Id, notification.Id);
        Assert.Equal(firstUserId, notification.UserId);
    }

    [Fact]
    public async Task MarkReadAsync_marks_one_notification_as_read()
    {
        using NotificationServiceHarness harness = NotificationServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        Notification notification = await harness.AddNotificationAsync(userId, "Unread");

        NotificationResponse response = await harness.Service.MarkReadAsync(
            harness.CreatePrincipal(userId),
            notification.Id,
            CancellationToken.None);

        Assert.True(response.IsRead);
        Assert.NotNull(response.ReadAtUtc);

        Notification storedNotification =
            await harness.DbContext.Notifications.SingleAsync();
        Assert.True(storedNotification.IsRead);
    }

    [Fact]
    public async Task MarkAllReadAsync_marks_only_the_authenticated_users_notifications_as_read()
    {
        using NotificationServiceHarness harness = NotificationServiceHarness.Create();
        Guid firstUserId = await harness.AddUserAsync("first@example.com");
        Guid secondUserId = await harness.AddUserAsync("second@example.com");
        await harness.AddNotificationAsync(firstUserId, "First one");
        await harness.AddNotificationAsync(firstUserId, "First two");
        Notification otherNotification = await harness.AddNotificationAsync(
            secondUserId,
            "Other");

        await harness.Service.MarkAllReadAsync(
            harness.CreatePrincipal(firstUserId),
            CancellationToken.None);

        Assert.Equal(0, await harness.DbContext.Notifications.CountAsync(
            notification => notification.UserId == firstUserId && !notification.IsRead));

        Notification storedOtherNotification =
            await harness.DbContext.Notifications.SingleAsync(
                notification => notification.Id == otherNotification.Id);
        Assert.False(storedOtherNotification.IsRead);
    }

    [Fact]
    public async Task DeleteAsync_deletes_the_authenticated_users_notification()
    {
        using NotificationServiceHarness harness = NotificationServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        Notification notification = await harness.AddNotificationAsync(userId, "Delete me");

        await harness.Service.DeleteAsync(
            harness.CreatePrincipal(userId),
            notification.Id,
            CancellationToken.None);

        Assert.Empty(harness.DbContext.Notifications);
    }

    [Fact]
    public async Task Notification_mutations_reject_another_users_notification()
    {
        using NotificationServiceHarness harness = NotificationServiceHarness.Create();
        Guid firstUserId = await harness.AddUserAsync("first@example.com");
        Guid secondUserId = await harness.AddUserAsync("second@example.com");
        Notification notification = await harness.AddNotificationAsync(firstUserId, "Private");

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.MarkReadAsync(
                harness.CreatePrincipal(secondUserId),
                notification.Id,
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status404NotFound, exception.StatusCode);
    }

    [Fact]
    public async Task ListAsync_supports_pagination_and_unread_filtering()
    {
        using NotificationServiceHarness harness = NotificationServiceHarness.Create();
        Guid userId = await harness.AddUserAsync("player@example.com");
        await harness.AddNotificationAsync(
            userId,
            "Old unread",
            createdAtUtc: new DateTimeOffset(2026, 6, 18, 10, 0, 0, TimeSpan.Zero));
        await harness.AddNotificationAsync(
            userId,
            "Middle read",
            isRead: true,
            createdAtUtc: new DateTimeOffset(2026, 6, 18, 11, 0, 0, TimeSpan.Zero));
        await harness.AddNotificationAsync(
            userId,
            "Newest unread",
            createdAtUtc: new DateTimeOffset(2026, 6, 18, 12, 0, 0, TimeSpan.Zero));
        await harness.AddNotificationAsync(
            userId,
            "Second newest unread",
            createdAtUtc: new DateTimeOffset(2026, 6, 18, 11, 30, 0, TimeSpan.Zero));

        NotificationListResponse response = await harness.Service.ListAsync(
            harness.CreatePrincipal(userId),
            page: 1,
            pageSize: 2,
            unreadOnly: true,
            CancellationToken.None);

        Assert.True(response.UnreadOnly);
        Assert.Equal(3, response.TotalCount);
        Assert.Equal(2, response.Items.Count);
        Assert.Equal("Newest unread", response.Items[0].Title);
        Assert.Equal("Second newest unread", response.Items[1].Title);
    }

    private sealed class NotificationServiceHarness : IDisposable
    {
        private NotificationServiceHarness(
            LevelHabitDbContext dbContext,
            INotificationService service,
            TestTimeProvider time)
        {
            DbContext = dbContext;
            Service = service;
            Time = time;
        }

        public LevelHabitDbContext DbContext { get; }

        public INotificationService Service { get; }

        public TestTimeProvider Time { get; }

        public static NotificationServiceHarness Create()
        {
            DbContextOptions<LevelHabitDbContext> options =
                new DbContextOptionsBuilder<LevelHabitDbContext>()
                    .UseInMemoryDatabase(Guid.NewGuid().ToString())
                    .Options;
            LevelHabitDbContext dbContext = new(options);
            TestTimeProvider time = new(new DateTimeOffset(2026, 6, 18, 12, 0, 0, TimeSpan.Zero));
            NotificationService service = new(dbContext, time);

            return new NotificationServiceHarness(dbContext, service, time);
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

        public async Task<Notification> AddNotificationAsync(
            Guid userId,
            string title,
            bool isRead = false,
            DateTimeOffset? createdAtUtc = null)
        {
            Notification notification = new()
            {
                UserId = userId,
                Type = NotificationType.System,
                Title = title,
                Message = "Test notification",
                IsRead = isRead,
                CreatedAtUtc = createdAtUtc ?? Time.GetUtcNow(),
                ReadAtUtc = isRead ? Time.GetUtcNow() : null
            };

            DbContext.Notifications.Add(notification);
            await DbContext.SaveChangesAsync();

            return notification;
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
