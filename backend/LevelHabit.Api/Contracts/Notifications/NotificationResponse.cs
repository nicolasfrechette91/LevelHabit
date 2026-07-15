namespace LevelHabit.Api.Contracts.Notifications;

public sealed record NotificationResponse(
    Guid Id,
    Guid UserId,
    Guid? HabitId,
    string Type,
    string Title,
    string Message,
    bool IsRead,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? ReadAtUtc,
    string? ReferenceUrl);
