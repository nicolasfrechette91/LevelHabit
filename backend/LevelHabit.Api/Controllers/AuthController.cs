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
    public async Task<ActionResult<RegisterResponse>> Register(
        RegisterRequest request,
        CancellationToken cancellationToken)
    {
        RegisterResponse response = await authService.RegisterAsync(
            request,
            cancellationToken);

        return StatusCode(StatusCodes.Status201Created, response);
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

    [HttpPost("forgot-password")]
    public async Task<ActionResult<AuthMessageResponse>> ForgotPassword(
        ForgotPasswordRequest request,
        CancellationToken cancellationToken)
    {
        AuthMessageResponse response = await authService.ForgotPasswordAsync(
            request,
            cancellationToken);

        return Ok(response);
    }

    [HttpPost("reset-password")]
    public async Task<ActionResult<AuthMessageResponse>> ResetPassword(
        ResetPasswordRequest request,
        CancellationToken cancellationToken)
    {
        AuthMessageResponse response = await authService.ResetPasswordAsync(
            request,
            cancellationToken);

        return Ok(response);
    }

    [HttpPost("confirm-email")]
    public async Task<ActionResult<AuthMessageResponse>> ConfirmEmail(
        ConfirmEmailRequest request,
        CancellationToken cancellationToken)
    {
        AuthMessageResponse response = await authService.ConfirmEmailAsync(
            request,
            cancellationToken);

        return Ok(response);
    }

    [HttpPost("resend-verification-code")]
    public async Task<ActionResult<AuthMessageResponse>> ResendVerificationCode(
        ResendVerificationCodeRequest request,
        CancellationToken cancellationToken)
    {
        AuthMessageResponse response =
            await authService.ResendVerificationCodeAsync(
                request,
                cancellationToken);

        return Ok(response);
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<MeResponse>> Me(CancellationToken cancellationToken)
    {
        MeResponse response = await authService.GetCurrentUserAsync(User, cancellationToken);

        return Ok(response);
    }
}
