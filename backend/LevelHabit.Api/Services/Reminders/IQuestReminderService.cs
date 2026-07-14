using System.Security.Claims;
using LevelHabit.Api.Contracts.Reminders;

namespace LevelHabit.Api.Services.Reminders;

public interface IQuestReminderService
{
    Task<QuestReminderResponse> GetAsync(
        ClaimsPrincipal principal,
        Guid questId,
        CancellationToken cancellationToken);

    Task<QuestReminderResponse> UpsertAsync(
        ClaimsPrincipal principal,
        Guid questId,
        UpsertQuestReminderRequest request,
        CancellationToken cancellationToken);

    Task DeleteAsync(
        ClaimsPrincipal principal,
        Guid questId,
        CancellationToken cancellationToken);
}
