using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using LevelHabit.Api.Middleware;

namespace LevelHabit.Api.Services.Security;

public static class AuthenticatedUser
{
    public static Guid GetUserId(ClaimsPrincipal principal)
    {
        string? userIdValue = principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? principal.FindFirstValue(JwtRegisteredClaimNames.Sub);

        if (!Guid.TryParse(userIdValue, out Guid userId))
        {
            throw new ApiException(
                StatusCodes.Status401Unauthorized,
                "Unauthorized",
                "The current access token is missing a valid user identifier.");
        }

        return userId;
    }
}
