using LevelHabit.Api.Contracts.Analytics;
using LevelHabit.Api.Services.Analytics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LevelHabit.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public sealed class AnalyticsController(IAnalyticsService analyticsService) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<ActionResult<AnalyticsSummaryResponse>> Summary(
        CancellationToken cancellationToken)
    {
        AnalyticsSummaryResponse summary = await analyticsService.GetSummaryAsync(
            User,
            cancellationToken);

        return Ok(summary);
    }
}
