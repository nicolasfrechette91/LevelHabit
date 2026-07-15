using LevelHabit.Api.Middleware;

namespace LevelHabit.Api.Services.Habits;

public static class HabitXpRewards
{
    public static int GetRewardForDifficulty(string difficulty)
    {
        return difficulty.Trim() switch
        {
            var value when string.Equals(value, "Easy", StringComparison.OrdinalIgnoreCase) => 10,
            var value when string.Equals(value, "Medium", StringComparison.OrdinalIgnoreCase) => 20,
            var value when string.Equals(value, "Hard", StringComparison.OrdinalIgnoreCase) => 35,
            _ => throw new ApiException(
                StatusCodes.Status500InternalServerError,
                "Habit difficulty is not supported",
                "The habit difficulty does not have an XP reward configured.")
        };
    }
}
