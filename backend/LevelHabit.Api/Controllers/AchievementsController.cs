using LevelHabit.Api.Contracts.Achievements;
using LevelHabit.Api.Services.Achievements;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LevelHabit.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public sealed class AchievementsController(IAchievementService achievementService)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AchievementResponse>>> List(
        CancellationToken cancellationToken)
    {
        IReadOnlyList<AchievementResponse> achievements =
            await achievementService.ListAsync(User, cancellationToken);

        return Ok(achievements);
    }
}
