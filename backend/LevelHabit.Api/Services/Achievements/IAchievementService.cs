using System.Security.Claims;
using LevelHabit.Api.Contracts.Achievements;

namespace LevelHabit.Api.Services.Achievements;

public interface IAchievementService
{
    Task<IReadOnlyList<AchievementResponse>> ListAsync(
        ClaimsPrincipal principal,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<AchievementResponse>> UnlockEligibleAsync(
        Guid userId,
        DateTimeOffset unlockedAtUtc,
        CancellationToken cancellationToken);
}
