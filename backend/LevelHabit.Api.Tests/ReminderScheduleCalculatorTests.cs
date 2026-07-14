using LevelHabit.Api.Services.Reminders;

namespace LevelHabit.Api.Tests;

public sealed class ReminderScheduleCalculatorTests
{
    private readonly ReminderScheduleCalculator calculator = new();

    [Fact]
    public void CalculateNextTriggerUtc_returns_next_daily_occurrence()
    {
        DateTimeOffset nowUtc = new(2026, 6, 18, 12, 0, 0, TimeSpan.Zero);

        DateTimeOffset next = calculator.CalculateNextTriggerUtc(
            new TimeOnly(8, 30),
            "America/Toronto",
            [
                DayOfWeek.Monday,
                DayOfWeek.Tuesday,
                DayOfWeek.Wednesday,
                DayOfWeek.Thursday,
                DayOfWeek.Friday,
                DayOfWeek.Saturday,
                DayOfWeek.Sunday
            ],
            nowUtc);

        Assert.Equal(new DateTimeOffset(2026, 6, 18, 12, 30, 0, TimeSpan.Zero), next);
    }

    [Fact]
    public void CalculateNextTriggerUtc_returns_next_selected_weekday_occurrence()
    {
        DateTimeOffset nowUtc = new(2026, 6, 19, 16, 0, 0, TimeSpan.Zero);

        DateTimeOffset next = calculator.CalculateNextTriggerUtc(
            new TimeOnly(8, 0),
            "America/Toronto",
            [DayOfWeek.Monday, DayOfWeek.Wednesday],
            nowUtc);

        Assert.Equal(new DateTimeOffset(2026, 6, 22, 12, 0, 0, TimeSpan.Zero), next);
    }

    [Fact]
    public void CalculateNextTriggerUtc_moves_invalid_daylight_saving_time_to_next_valid_local_time()
    {
        DateTimeOffset nowUtc = new(2026, 3, 8, 6, 0, 0, TimeSpan.Zero);

        DateTimeOffset next = calculator.CalculateNextTriggerUtc(
            new TimeOnly(2, 30),
            "America/Toronto",
            [DayOfWeek.Sunday],
            nowUtc);

        Assert.Equal(new DateTimeOffset(2026, 3, 8, 7, 0, 0, TimeSpan.Zero), next);
    }

    [Fact]
    public void CalculateNextTriggerUtc_uses_consistent_offset_for_ambiguous_daylight_saving_time()
    {
        DateTimeOffset nowUtc = new(2026, 11, 1, 4, 0, 0, TimeSpan.Zero);

        DateTimeOffset next = calculator.CalculateNextTriggerUtc(
            new TimeOnly(1, 30),
            "America/Toronto",
            [DayOfWeek.Sunday],
            nowUtc);

        Assert.Equal(new DateTimeOffset(2026, 11, 1, 6, 30, 0, TimeSpan.Zero), next);
    }
}
