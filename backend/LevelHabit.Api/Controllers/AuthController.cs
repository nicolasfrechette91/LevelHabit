using LevelHabit.Api.Contracts.Auth;
using LevelHabit.Api.Services.Auth;
using LevelHabit.Api.Services.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LevelHabit.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController(
    IAuthService authService,
    IAuthCookieService authCookieService) : ControllerBase
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

        authCookieService.WriteRefreshToken(
            Response,
            response.RefreshToken,
            response.RefreshTokenExpiresAtUtc);

        return Ok(response);
    }

    [HttpGet("csrf")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public ActionResult<CsrfTokenResponse> Csrf()
    {
        string csrfToken = authCookieService.IssueCsrfToken(Response);

        return Ok(new CsrfTokenResponse(csrfToken));
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh(
        CancellationToken cancellationToken)
    {
        authCookieService.ValidateCsrfToken(Request);
        RefreshRequest request = new(authCookieService.ReadRefreshToken(Request));
        AuthResponse response = await authService.RefreshAsync(request, cancellationToken);

        authCookieService.WriteRefreshToken(
            Response,
            response.RefreshToken,
            response.RefreshTokenExpiresAtUtc);

        return Ok(response);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(
        CancellationToken cancellationToken)
    {
        authCookieService.ValidateCsrfToken(Request);
        LogoutRequest request = new(authCookieService.ReadRefreshToken(Request));

        try
        {
            await authService.LogoutAsync(request, cancellationToken);
        }
        finally
        {
            authCookieService.ClearAuthenticationCookies(Response);
        }

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
