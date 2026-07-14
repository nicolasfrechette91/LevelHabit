namespace LevelHabit.Api.Services.Reminders;

public static class ReminderDays
{
    public const int ValidMask = 0b0111_1111;

    private static readonly DayOfWeek[] DisplayOrder =
    [
        DayOfWeek.Monday,
        DayOfWeek.Tuesday,
        DayOfWeek.Wednesday,
        DayOfWeek.Thursday,
        DayOfWeek.Friday,
        DayOfWeek.Saturday,
        DayOfWeek.Sunday
    ];

    public static int ToBitMask(IEnumerable<DayOfWeek> daysOfWeek)
    {
        int mask = 0;

        foreach (DayOfWeek dayOfWeek in daysOfWeek)
        {
            mask |= 1 << (int)dayOfWeek;
        }

        return mask;
    }

    public static IReadOnlyList<DayOfWeek> FromBitMask(int mask)
    {
        if ((mask & ~ValidMask) != 0)
        {
            return [];
        }

        return DisplayOrder
            .Where(dayOfWeek => (mask & (1 << (int)dayOfWeek)) != 0)
            .ToList();
    }

    public static IReadOnlyList<string> NamesFromBitMask(int mask)
    {
        return FromBitMask(mask)
            .Select(dayOfWeek => dayOfWeek.ToString())
            .ToList();
    }
}
