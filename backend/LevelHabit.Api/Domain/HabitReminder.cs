namespace LevelHabit.Api.Domain;

public sealed class HabitReminder
{
    public const int TimeZoneIdMaxLength = 128;

    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    public Guid HabitId { get; set; }

    public bool IsEnabled { get; set; }

    public TimeOnly TimeOfDay { get; set; }

    public string TimeZoneId { get; set; } = string.Empty;

    public int DaysOfWeek { get; set; }

    public DateTimeOffset? LastTriggeredAtUtc { get; set; }

    public DateTimeOffset? NextTriggerAtUtc { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset UpdatedAtUtc { get; set; }

    public User? User { get; set; }

    public Habit? Habit { get; set; }
}
