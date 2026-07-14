namespace LevelHabit.Api.Services.Progress;

public sealed record LevelProgress(
    int Level,
    int TotalXp,
    int XpInCurrentLevel,
    int XpRequiredForNextLevel,
    int XpToNextLevel);

public static class ProgressCalculator
{
    public const int StartingLevel = 1;

    public static LevelProgress Calculate(int totalXp)
    {
        int sanitizedTotalXp = Math.Max(0, totalXp);
        int level = StartingLevel;
        int remainingXp = sanitizedTotalXp;

        while (remainingXp >= GetXpRequiredForNextLevel(level))
        {
            remainingXp -= GetXpRequiredForNextLevel(level);
            level++;
        }

        int xpRequiredForNextLevel = GetXpRequiredForNextLevel(level);

        return new LevelProgress(
            Level: level,
            TotalXp: sanitizedTotalXp,
            XpInCurrentLevel: remainingXp,
            XpRequiredForNextLevel: xpRequiredForNextLevel,
            XpToNextLevel: xpRequiredForNextLevel - remainingXp);
    }

    public static int GetXpRequiredForNextLevel(int level)
    {
        return Math.Max(StartingLevel, level) * 100;
    }
}
