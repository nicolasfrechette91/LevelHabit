using System.Security.Claims;
using LevelHabit.Api.Contracts.Notifications;
using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using LevelHabit.Api.Middleware;
using LevelHabit.Api.Services.Security;
using Microsoft.EntityFrameworkCore;

namespace LevelHabit.Api.Services.Notifications;

public sealed class NotificationService(
    LevelHabitDbContext dbContext,
    TimeProvider timeProvider) : INotificationService
{
    private const int DefaultPage = 1;
    private const int DefaultPageSize = 20;
    private const int MaximumPageSize = 50;

    public async Task<NotificationListResponse> ListAsync(
        ClaimsPrincipal principal,
        int page,
        int pageSize,
        bool unreadOnly,
        CancellationToken cancellationToken)
    {
        Guid userId = AuthenticatedUser.GetUserId(principal);
        int normalizedPage = Math.Max(DefaultPage, page);
        int normalizedPageSize = pageSize <= 0
            ? DefaultPageSize
            : Math.Min(pageSize, MaximumPageSize);
        IQueryable<Notification> query = dbContext.Notifications
            .AsNoTracking()
            .Where(notification => notification.UserId == userId);

        if (unreadOnly)
        {
            query = query.Where(notification => !notification.IsRead);
        }

        int totalCount = await query.CountAsync(cancellationToken);
        List<Notification> notifications = await query
            .OrderByDescending(notification => notification.CreatedAtUtc)
            .Skip((normalizedPage - 1) * normalizedPageSize)
            .Take(normalizedPageSize)
            .ToListAsync(cancellationToken);

        return new NotificationListResponse(
            Items: notifications.Select(MapNotification).ToList(),
            Page: normalizedPage,
            PageSize: normalizedPageSize,
            TotalCount: totalCount,
            UnreadOnly: unreadOnly);
    }

    public async Task<NotificationUnreadCountResponse> GetUnreadCountAsync(
        ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        Guid userId = AuthenticatedUser.GetUserId(principal);
        int count = await dbContext.Notifications.CountAsync(
            notification => notification.UserId == userId && !notification.IsRead,
            cancellationToken);

        return new NotificationUnreadCountResponse(count);
    }

    public async Task<NotificationResponse> MarkReadAsync(
        ClaimsPrincipal principal,
        Guid notificationId,
        CancellationToken cancellationToken)
    {
        Guid userId = AuthenticatedUser.GetUserId(principal);
        Notification notification = await FindOwnedNotificationAsync(
            userId,
            notificationId,
            cancellationToken);

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            notification.ReadAtUtc = timeProvider.GetUtcNow();
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return MapNotification(notification);
    }

    public async Task MarkAllReadAsync(
        ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        Guid userId = AuthenticatedUser.GetUserId(principal);
        DateTimeOffset now = timeProvider.GetUtcNow();
        List<Notification> unreadNotifications = await dbContext.Notifications
            .Where(notification => notification.UserId == userId && !notification.IsRead)
            .ToListAsync(cancellationToken);

        foreach (Notification notification in unreadNotifications)
        {
            notification.IsRead = true;
            notification.ReadAtUtc = now;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(
        ClaimsPrincipal principal,
        Guid notificationId,
        CancellationToken cancellationToken)
    {
        Guid userId = AuthenticatedUser.GetUserId(principal);
        Notification notification = await FindOwnedNotificationAsync(
            userId,
            notificationId,
            cancellationToken);

        dbContext.Notifications.Remove(notification);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<Notification> FindOwnedNotificationAsync(
        Guid userId,
        Guid notificationId,
        CancellationToken cancellationToken)
    {
        Notification? notification = await dbContext.Notifications
            .SingleOrDefaultAsync(
                candidate => candidate.Id == notificationId && candidate.UserId == userId,
                cancellationToken);

        return notification ?? throw new ApiException(
            StatusCodes.Status404NotFound,
            "Notification not found",
            "The requested notification could not be found.");
    }

    public static NotificationResponse MapNotification(Notification notification)
    {
        return new NotificationResponse(
            Id: notification.Id,
            UserId: notification.UserId,
            QuestId: notification.QuestId,
            Type: notification.Type.ToString(),
            Title: notification.Title,
            Message: notification.Message,
            IsRead: notification.IsRead,
            CreatedAtUtc: notification.CreatedAtUtc,
            ReadAtUtc: notification.ReadAtUtc,
            ReferenceUrl: notification.ReferenceUrl);
    }
}
