using LevelHabit.Api.Services.Heroes;

namespace LevelHabit.Api.Tests;

public sealed class HeroProgressCalculatorTests
{
    [Theory]
    [InlineData(0, 1, 0, 100, 100)]
    [InlineData(99, 1, 99, 100, 1)]
    [InlineData(100, 2, 0, 200, 200)]
    [InlineData(299, 2, 199, 200, 1)]
    [InlineData(300, 3, 0, 300, 300)]
    public void Calculate_returns_deterministic_level_progress(
        int totalXp,
        int expectedLevel,
        int expectedXpInCurrentLevel,
        int expectedXpRequiredForNextLevel,
        int expectedXpToNextLevel)
    {
        HeroProgress progress = HeroProgressCalculator.Calculate(totalXp);

        Assert.Equal(expectedLevel, progress.Level);
        Assert.Equal(expectedXpInCurrentLevel, progress.XpInCurrentLevel);
        Assert.Equal(expectedXpRequiredForNextLevel, progress.XpRequiredForNextLevel);
        Assert.Equal(expectedXpToNextLevel, progress.XpToNextLevel);
    }
}
