namespace LevelHabit.Api.Services.Reminders;

public interface IQuestReminderProcessor
{
    Task<int> ProcessDueAsync(CancellationToken cancellationToken);
}
