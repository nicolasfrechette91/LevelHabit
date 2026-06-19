using System.Security.Claims;
using LevelHabit.Api.Contracts.Analytics;

namespace LevelHabit.Api.Services.Analytics;

public interface IAnalyticsService
{
    Task<AnalyticsSummaryResponse> GetSummaryAsync(
        ClaimsPrincipal principal,
        CancellationToken cancellationToken);
}
