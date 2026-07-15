namespace LevelHabit.Api.Services.Habits;

public sealed record HabitStreak(
    int CurrentStreak,
    int BestStreak,
    DateOnly? LastCompletedDateUtc,
    DateTimeOffset? LastCompletedAtUtc);
