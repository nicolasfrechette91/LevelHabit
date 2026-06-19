namespace LevelHabit.Api.Services.Quests;

public static class QuestStreakCalculator
{
    public static QuestStreak Calculate(
        IEnumerable<QuestCompletionStreakEntry> completions,
        DateOnly todayUtc)
    {
        List<CompletionDay> orderedDays = completions
            .GroupBy(completion => completion.CompletionDateUtc)
            .Select(group => new CompletionDay(
                group.Key,
                group.Max(completion => completion.CompletedAtUtc)))
            .OrderBy(completion => completion.CompletionDateUtc)
            .ToList();

        if (orderedDays.Count == 0)
        {
            return new QuestStreak(
                CurrentStreak: 0,
                BestStreak: 0,
                LastCompletedDateUtc: null,
                LastCompletedAtUtc: null);
        }

        int bestStreak = 0;
        int runningStreak = 0;
        DateOnly? previousDate = null;
        Dictionary<DateOnly, int> streaksByDate = [];

        foreach (CompletionDay completionDay in orderedDays)
        {
            runningStreak = previousDate.HasValue
                && completionDay.CompletionDateUtc.DayNumber == previousDate.Value.DayNumber + 1
                    ? runningStreak + 1
                    : 1;

            streaksByDate[completionDay.CompletionDateUtc] = runningStreak;
            bestStreak = Math.Max(bestStreak, runningStreak);
            previousDate = completionDay.CompletionDateUtc;
        }

        CompletionDay latestCompletion = orderedDays[^1];
        int currentStreak = IsCurrent(latestCompletion.CompletionDateUtc, todayUtc)
            ? streaksByDate[latestCompletion.CompletionDateUtc]
            : 0;

        return new QuestStreak(
            CurrentStreak: currentStreak,
            BestStreak: bestStreak,
            LastCompletedDateUtc: latestCompletion.CompletionDateUtc,
            LastCompletedAtUtc: latestCompletion.CompletedAtUtc);
    }

    private static bool IsCurrent(DateOnly latestCompletionDateUtc, DateOnly todayUtc)
    {
        return latestCompletionDateUtc == todayUtc
            || latestCompletionDateUtc.DayNumber == todayUtc.DayNumber - 1;
    }

    private sealed record CompletionDay(
        DateOnly CompletionDateUtc,
        DateTimeOffset CompletedAtUtc);
}
