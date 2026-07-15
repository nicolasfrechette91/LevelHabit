using LevelHabit.Api.Contracts.Auth;

namespace LevelHabit.Api.Contracts.Habits;

public sealed record HabitCompletionResponse(
    Guid Id,
    Guid HabitId,
    Guid UserId,
    DateOnly CompletionDateUtc,
    DateTimeOffset CompletedAtUtc,
    int XpAwarded,
    bool WasAlreadyCompleted,
    ProgressProfileResponse ProgressProfile,
    HabitResponse Habit);
