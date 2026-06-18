using System.Security.Claims;
using LevelHabit.Api.Contracts.Auth;

namespace LevelHabit.Api.Services.Auth;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken);

    Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken);

    Task<MeResponse> GetCurrentUserAsync(ClaimsPrincipal principal, CancellationToken cancellationToken);
}
