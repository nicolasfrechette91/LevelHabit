namespace LevelHabit.Api.Domain;

public sealed class HabitCompletion
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    public Guid HabitId { get; set; }

    public DateOnly CompletionDateUtc { get; set; }

    public DateTimeOffset CompletedAtUtc { get; set; }

    public int XpAwarded { get; set; }

    public User? User { get; set; }

    public Habit? Habit { get; set; }
}
