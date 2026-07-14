namespace LevelHabit.Api.Contracts.Notifications;

public sealed record NotificationListResponse(
    IReadOnlyList<NotificationResponse> Items,
    int Page,
    int PageSize,
    int TotalCount,
    bool UnreadOnly);
