namespace LevelHabit.Api.Services.Security;

public interface IAuthCookieService
{
    string? ReadRefreshToken(HttpRequest request);

    void WriteRefreshToken(
        HttpResponse response,
        string refreshToken,
        DateTimeOffset expiresAtUtc);

    string IssueCsrfToken(HttpResponse response);

    void ValidateCsrfToken(HttpRequest request);

    void ClearAuthenticationCookies(HttpResponse response);
}
