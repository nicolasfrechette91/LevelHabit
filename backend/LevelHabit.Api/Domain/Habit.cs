namespace LevelHabit.Api.Domain;

public sealed class Habit
{
    public const int TitleMaxLength = 140;
    public const int DescriptionMaxLength = 1000;
    public const int CategoryMaxLength = 40;
    public const int DifficultyMaxLength = 20;
    public const int FrequencyMaxLength = 20;

    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;

    public string Difficulty { get; set; } = string.Empty;

    public string Frequency { get; set; } = string.Empty;

    public bool IsArchived { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset UpdatedAtUtc { get; set; }

    public User? User { get; set; }

    public ICollection<HabitCompletion> Completions { get; set; } = [];

    public HabitReminder? Reminder { get; set; }

    public ICollection<Notification> Notifications { get; set; } = [];
}
