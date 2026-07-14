namespace LevelHabit.Api.Domain;

public sealed class Notification
{
    public const int TypeMaxLength = 40;
    public const int TitleMaxLength = 160;
    public const int MessageMaxLength = 1000;
    public const int ReferenceUrlMaxLength = 512;
    public const int DeduplicationKeyMaxLength = 256;

    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    public Guid? QuestId { get; set; }

    public NotificationType Type { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public bool IsRead { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? ReadAtUtc { get; set; }

    public string? ReferenceUrl { get; set; }

    public string? DeduplicationKey { get; set; }

    public User? User { get; set; }

    public Quest? Quest { get; set; }
}
