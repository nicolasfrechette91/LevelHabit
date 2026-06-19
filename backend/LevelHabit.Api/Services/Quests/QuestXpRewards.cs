using LevelHabit.Api.Middleware;

namespace LevelHabit.Api.Services.Quests;

public static class QuestXpRewards
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
                "Quest difficulty is not supported",
                "The quest difficulty does not have an XP reward configured.")
        };
    }
}
