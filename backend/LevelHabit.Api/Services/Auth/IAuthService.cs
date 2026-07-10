using System.Security.Claims;
using LevelHabit.Api.Contracts.Auth;

namespace LevelHabit.Api.Services.Auth;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken);

    Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken);

    Task<AuthResponse> RefreshAsync(RefreshRequest request, CancellationToken cancellationToken);

    Task LogoutAsync(LogoutRequest request, CancellationToken cancellationToken);

    Task<AuthMessageResponse> ForgotPasswordAsync(
        ForgotPasswordRequest request,
        CancellationToken cancellationToken);

    Task<AuthMessageResponse> ResetPasswordAsync(
        ResetPasswordRequest request,
        CancellationToken cancellationToken);

    Task<AuthMessageResponse> VerifyEmailAsync(
        VerifyEmailRequest request,
        CancellationToken cancellationToken);

    Task<AuthMessageResponse> ResendEmailVerificationAsync(
        ResendEmailVerificationRequest request,
        CancellationToken cancellationToken);

    Task<MeResponse> GetCurrentUserAsync(ClaimsPrincipal principal, CancellationToken cancellationToken);
}
