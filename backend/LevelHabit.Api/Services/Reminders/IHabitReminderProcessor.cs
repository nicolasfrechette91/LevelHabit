namespace LevelHabit.Api.Services.Reminders;

public interface IHabitReminderProcessor
{
    Task<int> ProcessDueAsync(CancellationToken cancellationToken);
}
