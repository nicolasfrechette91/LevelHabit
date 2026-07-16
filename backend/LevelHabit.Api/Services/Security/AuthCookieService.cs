using System.Security.Cryptography;
using System.Text;
using LevelHabit.Api.Auth;
using LevelHabit.Api.Middleware;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace LevelHabit.Api.Services.Security;

public sealed class AuthCookieService(
    IOptions<AuthCookieOptions> authCookieOptions) : IAuthCookieService
{
    public const string CsrfHeaderName = "X-LevelHabit-CSRF";
    private const string CookiePath = "/api/auth";
    private const int CsrfTokenByteLength = 32;
    private readonly AuthCookieOptions options = authCookieOptions.Value;

    public string? ReadRefreshToken(HttpRequest request)
    {
        return request.Cookies.TryGetValue(options.RefreshTokenName, out string? token)
            ? token
            : null;
    }

    public void WriteRefreshToken(
        HttpResponse response,
        string refreshToken,
        DateTimeOffset expiresAtUtc)
    {
        response.Cookies.Append(
            options.RefreshTokenName,
            refreshToken,
            CreateCookieOptions(expiresAtUtc));
    }

    public string IssueCsrfToken(HttpResponse response)
    {
        string token = WebEncoders.Base64UrlEncode(
            RandomNumberGenerator.GetBytes(CsrfTokenByteLength));

        response.Cookies.Append(
            options.CsrfTokenName,
            token,
            CreateCookieOptions(expiresAtUtc: null));

        return token;
    }

    public void ValidateCsrfToken(HttpRequest request)
    {
        string? cookieToken = request.Cookies[options.CsrfTokenName];
        string? headerToken = request.Headers[CsrfHeaderName].FirstOrDefault();

        if (
            string.IsNullOrWhiteSpace(cookieToken)
            || string.IsNullOrWhiteSpace(headerToken)
            || !FixedTimeEquals(cookieToken, headerToken))
        {
            throw new ApiException(
                StatusCodes.Status403Forbidden,
                "Invalid CSRF token",
                "A valid CSRF token is required for this authentication request.");
        }
    }

    public void ClearAuthenticationCookies(HttpResponse response)
    {
        CookieOptions expiredCookieOptions = CreateCookieOptions(DateTimeOffset.UnixEpoch);
        expiredCookieOptions.MaxAge = TimeSpan.Zero;

        response.Cookies.Delete(options.RefreshTokenName, expiredCookieOptions);
        response.Cookies.Delete(options.CsrfTokenName, expiredCookieOptions);
    }

    private CookieOptions CreateCookieOptions(DateTimeOffset? expiresAtUtc)
    {
        return new CookieOptions
        {
            HttpOnly = true,
            Secure = options.Secure,
            SameSite = options.SameSite,
            Path = CookiePath,
            Expires = expiresAtUtc,
            IsEssential = true
        };
    }

    private static bool FixedTimeEquals(string left, string right)
    {
        byte[] leftBytes = Encoding.UTF8.GetBytes(left);
        byte[] rightBytes = Encoding.UTF8.GetBytes(right);

        return leftBytes.Length == rightBytes.Length
            && CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
    }
}
