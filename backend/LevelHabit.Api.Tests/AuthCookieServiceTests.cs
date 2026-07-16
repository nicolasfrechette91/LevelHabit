using System.Text.Json;
using LevelHabit.Api.Auth;
using LevelHabit.Api.Contracts.Auth;
using LevelHabit.Api.Middleware;
using LevelHabit.Api.Services.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

namespace LevelHabit.Api.Tests;

public sealed class AuthCookieServiceTests
{
    private static readonly AuthCookieOptions ProductionCookieOptions = new()
    {
        RefreshTokenName = "LevelHabit.Refresh",
        CsrfTokenName = "LevelHabit.Csrf",
        Secure = true,
        SameSite = SameSiteMode.None,
        Path = "/api/auth"
    };

    [Fact]
    public void Auth_response_json_does_not_include_refresh_token_data()
    {
        AuthResponse response = new(
            AccessToken: "access-token",
            ExpiresAtUtc: DateTimeOffset.Parse("2099-01-01T00:00:00Z"),
            RefreshToken: "refresh-token-must-not-be-serialized",
            RefreshTokenExpiresAtUtc: DateTimeOffset.Parse("2099-02-01T00:00:00Z"),
            User: new UserResponse(
                Guid.NewGuid(),
                "player@example.com",
                "Player One",
                DateTimeOffset.Parse("2026-06-17T20:00:00Z")),
            ProgressProfile: new ProgressProfileResponse(
                Guid.NewGuid(),
                "Morning Warden",
                1,
                0,
                0,
                100,
                100,
                0,
                DateTimeOffset.Parse("2026-06-17T20:00:00Z")));

        string json = JsonSerializer.Serialize(response);

        Assert.DoesNotContain("refresh-token-must-not-be-serialized", json);
        Assert.DoesNotContain("RefreshToken", json);
        Assert.Contains("AccessToken", json);
    }

    [Fact]
    public void Refresh_cookie_is_http_only_secure_and_cross_site()
    {
        DefaultHttpContext context = new();
        AuthCookieService service = CreateService();

        service.WriteRefreshToken(
            context.Response,
            "refresh-token",
            DateTimeOffset.Parse("2099-02-01T00:00:00Z"));

        string? setCookieHeader = Assert.Single(context.Response.Headers.SetCookie);
        string setCookie = Assert.IsType<string>(setCookieHeader);
        Assert.Contains("LevelHabit.Refresh=refresh-token", setCookie);
        Assert.Contains("httponly", setCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secure", setCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=none", setCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/api/auth", setCookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Matching_double_submit_csrf_token_is_accepted()
    {
        DefaultHttpContext issueContext = new();
        AuthCookieService service = CreateService();
        string token = service.IssueCsrfToken(issueContext.Response);
        DefaultHttpContext requestContext = new();
        requestContext.Request.Headers.Cookie = $"LevelHabit.Csrf={token}";
        requestContext.Request.Headers[AuthCookieService.CsrfHeaderName] = token;

        service.ValidateCsrfToken(requestContext.Request);
    }

    [Fact]
    public void Missing_or_mismatched_csrf_token_is_rejected()
    {
        AuthCookieService service = CreateService();
        DefaultHttpContext context = new();
        context.Request.Headers.Cookie = "LevelHabit.Csrf=cookie-token";
        context.Request.Headers[AuthCookieService.CsrfHeaderName] = "different-token";

        ApiException exception = Assert.Throws<ApiException>(
            () => service.ValidateCsrfToken(context.Request));

        Assert.Equal(StatusCodes.Status403Forbidden, exception.StatusCode);
    }

    [Fact]
    public void Logout_cookie_clear_expires_refresh_and_csrf_cookies()
    {
        DefaultHttpContext context = new();
        AuthCookieService service = CreateService();

        service.ClearAuthenticationCookies(context.Response);

        string[] setCookies = context.Response.Headers.SetCookie
            .Select(value => value ?? string.Empty)
            .ToArray();
        Assert.Equal(2, setCookies.Length);
        Assert.Contains(setCookies, value => value.StartsWith("LevelHabit.Refresh="));
        Assert.Contains(setCookies, value => value.StartsWith("LevelHabit.Csrf="));
        Assert.All(
            setCookies,
            value =>
            {
                Assert.Contains(
                    "expires=Thu, 01 Jan 1970",
                    value,
                    StringComparison.OrdinalIgnoreCase);
                Assert.Contains("max-age=0", value, StringComparison.OrdinalIgnoreCase);
                Assert.Contains("path=/api/auth", value, StringComparison.OrdinalIgnoreCase);
                Assert.Contains("secure", value, StringComparison.OrdinalIgnoreCase);
                Assert.Contains("httponly", value, StringComparison.OrdinalIgnoreCase);
                Assert.Contains("samesite=none", value, StringComparison.OrdinalIgnoreCase);
            });
    }

    [Fact]
    public void Cookie_deletion_uses_the_same_configured_path_and_domain_as_creation()
    {
        AuthCookieOptions configuredOptions = new()
        {
            RefreshTokenName = "LevelHabit.Refresh",
            CsrfTokenName = "LevelHabit.Csrf",
            Secure = true,
            SameSite = SameSiteMode.None,
            Path = "/configured/auth",
            Domain = "api.example.com"
        };
        AuthCookieService service = new(Options.Create(configuredOptions));
        DefaultHttpContext creationContext = new();
        DefaultHttpContext deletionContext = new();

        service.WriteRefreshToken(
            creationContext.Response,
            "refresh-token",
            DateTimeOffset.Parse("2099-02-01T00:00:00Z"));
        service.ClearAuthenticationCookies(deletionContext.Response);

        string createdCookie = Assert.IsType<string>(
            Assert.Single(creationContext.Response.Headers.SetCookie));
        string[] deletedCookies = deletionContext.Response.Headers.SetCookie
            .Select(value => value ?? string.Empty)
            .ToArray();

        Assert.Contains("path=/configured/auth", createdCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("domain=api.example.com", createdCookie, StringComparison.OrdinalIgnoreCase);
        Assert.All(
            deletedCookies,
            value =>
            {
                Assert.Contains("path=/configured/auth", value, StringComparison.OrdinalIgnoreCase);
                Assert.Contains("domain=api.example.com", value, StringComparison.OrdinalIgnoreCase);
            });
    }

    private static AuthCookieService CreateService()
    {
        return new AuthCookieService(Options.Create(ProductionCookieOptions));
    }
}
