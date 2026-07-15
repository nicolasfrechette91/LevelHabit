namespace LevelHabit.Api.Services.Habits;

public sealed record HabitCompletionStreakEntry(
    DateOnly CompletionDateUtc,
    DateTimeOffset CompletedAtUtc);
