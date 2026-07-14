namespace LevelHabit.Api.Services.Reminders;

public sealed class QuestReminderBackgroundService(
    IServiceScopeFactory scopeFactory,
    ILogger<QuestReminderBackgroundService> logger) : BackgroundService
{
    private static readonly TimeSpan ProcessingInterval = TimeSpan.FromMinutes(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using IServiceScope scope = scopeFactory.CreateScope();
                IQuestReminderProcessor processor =
                    scope.ServiceProvider.GetRequiredService<IQuestReminderProcessor>();

                int notificationCount = await processor.ProcessDueAsync(stoppingToken);

                if (notificationCount > 0)
                {
                    logger.LogInformation(
                        "Created {NotificationCount} quest reminder notifications.",
                        notificationCount);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(
                    exception,
                    "Quest reminder processing failed and will be retried.");
            }

            try
            {
                await Task.Delay(ProcessingInterval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }
}
