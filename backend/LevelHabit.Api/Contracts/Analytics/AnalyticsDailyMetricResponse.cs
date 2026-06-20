namespace LevelHabit.Api.Contracts.Analytics;

public sealed record AnalyticsDailyMetricResponse(
    DateOnly DateUtc,
    int Value);
