namespace LevelHabit.Api.Contracts.Habits;

public sealed record HabitResponse(
    Guid Id,
    Guid UserId,
    string Title,
    string Description,
    string Category,
    string Difficulty,
    string Frequency,
    int XpReward,
    bool IsArchived,
    bool CompletedToday,
    int? CompletedTodayXpAwarded,
    DateTimeOffset? CompletedTodayAtUtc,
    int CurrentStreak,
    int BestStreak,
    DateOnly? LastCompletedDateUtc,
    DateTimeOffset? LastCompletedAtUtc,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);
