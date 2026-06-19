namespace LevelHabit.Api.Domain;

public sealed class QuestCompletion
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    public Guid QuestId { get; set; }

    public DateOnly CompletionDateUtc { get; set; }

    public DateTimeOffset CompletedAtUtc { get; set; }

    public int XpAwarded { get; set; }

    public User? User { get; set; }

    public Quest? Quest { get; set; }
}
