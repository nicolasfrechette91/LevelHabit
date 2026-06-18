using System.Security.Claims;
using LevelHabit.Api.Contracts.Quests;

namespace LevelHabit.Api.Services.Quests;

public interface IQuestService
{
    Task<IReadOnlyList<QuestResponse>> ListAsync(
        ClaimsPrincipal principal,
        bool includeArchived,
        CancellationToken cancellationToken);

    Task<QuestResponse> GetAsync(
        ClaimsPrincipal principal,
        Guid questId,
        CancellationToken cancellationToken);

    Task<QuestResponse> CreateAsync(
        ClaimsPrincipal principal,
        CreateQuestRequest request,
        CancellationToken cancellationToken);

    Task<QuestResponse> UpdateAsync(
        ClaimsPrincipal principal,
        Guid questId,
        UpdateQuestRequest request,
        CancellationToken cancellationToken);

    Task ArchiveAsync(
        ClaimsPrincipal principal,
        Guid questId,
        CancellationToken cancellationToken);
}
