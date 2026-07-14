using System.Security.Claims;
using LevelHabit.Api.Contracts.Notifications;

namespace LevelHabit.Api.Services.Notifications;

public interface INotificationService
{
    Task<NotificationListResponse> ListAsync(
        ClaimsPrincipal principal,
        int page,
        int pageSize,
        bool unreadOnly,
        CancellationToken cancellationToken);

    Task<NotificationUnreadCountResponse> GetUnreadCountAsync(
        ClaimsPrincipal principal,
        CancellationToken cancellationToken);

    Task<NotificationResponse> MarkReadAsync(
        ClaimsPrincipal principal,
        Guid notificationId,
        CancellationToken cancellationToken);

    Task MarkAllReadAsync(
        ClaimsPrincipal principal,
        CancellationToken cancellationToken);

    Task DeleteAsync(
        ClaimsPrincipal principal,
        Guid notificationId,
        CancellationToken cancellationToken);
}
