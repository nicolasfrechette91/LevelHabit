using Microsoft.AspNetCore.Mvc;

namespace LevelHabit.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class HealthController : ControllerBase
{
    [HttpGet]
    public ActionResult<HealthResponse> Get()
    {
        return Ok(new HealthResponse(
            Status: "ok",
            Service: "LevelHabit API",
            TimestampUtc: DateTimeOffset.UtcNow));
    }
}

public sealed record HealthResponse(
    string Status,
    string Service,
    DateTimeOffset TimestampUtc);
