using System.ComponentModel.DataAnnotations;

namespace LevelHabit.Api.Auth;

public sealed class AuthCookieOptions
{
    public const string SectionName = "AuthCookies";

    [Required]
    public string RefreshTokenName { get; init; } = "LevelHabit.Refresh";

    [Required]
    public string CsrfTokenName { get; init; } = "LevelHabit.Csrf";

    public bool Secure { get; init; } = true;

    public SameSiteMode SameSite { get; init; } = SameSiteMode.None;

    [Required]
    public string Path { get; init; } = "/api/auth";

    public string? Domain { get; init; }
}
