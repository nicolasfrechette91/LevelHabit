using System.Reflection;
using System.Security.Claims;
using LevelHabit.Api.Auth;
using LevelHabit.Api.Contracts.Auth;
using LevelHabit.Api.Controllers;
using LevelHabit.Api.Services.Auth;
using LevelHabit.Api.Services.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace LevelHabit.Api.Tests;

public sealed class AuthControllerTests
{
    [Fact]
    public void Me_endpoint_requires_authorization()
    {
        MethodInfo method = typeof(AuthController).GetMethod(nameof(AuthController.Me))
            ?? throw new InvalidOperationException("AuthController.Me could not be found.");

        Assert.Contains(
            method.GetCustomAttributes<AuthorizeAttribute>(),
            attribute => attribute.Policy is null);
    }

    [Fact]
    public async Task Logout_passes_the_refresh_token_for_revocation_and_returns_expired_cookies()
    {
        RecordingAuthService authService = new();
        AuthCookieService cookieService = new(Options.Create(new AuthCookieOptions
        {
            RefreshTokenName = "LevelHabit.Refresh",
            CsrfTokenName = "LevelHabit.Csrf",
            Secure = true,
            SameSite = SameSiteMode.None,
            Path = "/api/auth"
        }));
        DefaultHttpContext context = new();
        context.Request.Headers.Cookie =
            "LevelHabit.Refresh=refresh-token; LevelHabit.Csrf=csrf-token";
        context.Request.Headers[AuthCookieService.CsrfHeaderName] = "csrf-token";
        AuthController controller = new(authService, cookieService)
        {
            ControllerContext = new ControllerContext { HttpContext = context }
        };

        IActionResult result = await controller.Logout(CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        Assert.Equal("refresh-token", authService.LogoutRefreshToken);
        string[] setCookies = context.Response.Headers.SetCookie
            .Select(value => value ?? string.Empty)
            .ToArray();
        Assert.Equal(2, setCookies.Length);
        Assert.Contains(setCookies, value => value.StartsWith("LevelHabit.Refresh="));
        Assert.Contains(setCookies, value => value.StartsWith("LevelHabit.Csrf="));
        Assert.All(
            setCookies,
            value => Assert.Contains(
                "expires=Thu, 01 Jan 1970",
                value,
                StringComparison.OrdinalIgnoreCase));
    }

    private sealed class RecordingAuthService : IAuthService
    {
        public string? LogoutRefreshToken { get; private set; }

        public Task LogoutAsync(
            LogoutRequest request,
            CancellationToken cancellationToken)
        {
            LogoutRefreshToken = request.RefreshToken;
            return Task.CompletedTask;
        }

        public Task<RegisterResponse> RegisterAsync(
            RegisterRequest request,
            CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<AuthResponse> LoginAsync(
            LoginRequest request,
            CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<AuthResponse> RefreshAsync(
            RefreshRequest request,
            CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<AuthMessageResponse> ForgotPasswordAsync(
            ForgotPasswordRequest request,
            CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<AuthMessageResponse> ResetPasswordAsync(
            ResetPasswordRequest request,
            CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<AuthMessageResponse> ConfirmEmailAsync(
            ConfirmEmailRequest request,
            CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<AuthMessageResponse> ResendVerificationCodeAsync(
            ResendVerificationCodeRequest request,
            CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<MeResponse> GetCurrentUserAsync(
            ClaimsPrincipal principal,
            CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
