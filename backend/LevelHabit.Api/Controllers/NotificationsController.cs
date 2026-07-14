using LevelHabit.Api.Contracts.Notifications;
using LevelHabit.Api.Services.Notifications;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LevelHabit.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public sealed class NotificationsController(INotificationService notificationService)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<NotificationListResponse>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] bool unreadOnly = false,
        CancellationToken cancellationToken = default)
    {
        NotificationListResponse notifications = await notificationService.ListAsync(
            User,
            page,
            pageSize,
            unreadOnly,
            cancellationToken);

        return Ok(notifications);
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<NotificationUnreadCountResponse>> UnreadCount(
        CancellationToken cancellationToken)
    {
        NotificationUnreadCountResponse response =
            await notificationService.GetUnreadCountAsync(User, cancellationToken);

        return Ok(response);
    }

    [HttpPut("{id:guid}/read")]
    public async Task<ActionResult<NotificationResponse>> MarkRead(
        Guid id,
        CancellationToken cancellationToken)
    {
        NotificationResponse notification = await notificationService.MarkReadAsync(
            User,
            id,
            cancellationToken);

        return Ok(notification);
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken cancellationToken)
    {
        await notificationService.MarkAllReadAsync(User, cancellationToken);

        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(
        Guid id,
        CancellationToken cancellationToken)
    {
        await notificationService.DeleteAsync(User, id, cancellationToken);

        return NoContent();
    }
}
