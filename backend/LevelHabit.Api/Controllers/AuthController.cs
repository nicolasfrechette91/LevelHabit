using LevelHabit.Api.Contracts.Auth;
using LevelHabit.Api.Services.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LevelHabit.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController(IAuthService authService) : ControllerBase
{
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(
        RegisterRequest request,
        CancellationToken cancellationToken)
    {
        AuthResponse response = await authService.RegisterAsync(request, cancellationToken);

        return CreatedAtAction(nameof(Me), routeValues: null, value: response);
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        AuthResponse response = await authService.LoginAsync(request, cancellationToken);

        return Ok(response);
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh(
        RefreshRequest request,
        CancellationToken cancellationToken)
    {
        AuthResponse response = await authService.RefreshAsync(request, cancellationToken);

        return Ok(response);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(
        LogoutRequest request,
        CancellationToken cancellationToken)
    {
        await authService.LogoutAsync(request, cancellationToken);

        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<MeResponse>> Me(CancellationToken cancellationToken)
    {
        MeResponse response = await authService.GetCurrentUserAsync(User, cancellationToken);

        return Ok(response);
    }
}
