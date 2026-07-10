using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using LevelHabit.Api.Contracts.Auth;
using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using LevelHabit.Api.Middleware;
using LevelHabit.Api.Services.Email;
using LevelHabit.Api.Services.Heroes;
using LevelHabit.Api.Services.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace LevelHabit.Api.Services.Auth;

public sealed class AuthService(
    LevelHabitDbContext dbContext,
    IPasswordHashService passwordHashService,
    IJwtTokenService jwtTokenService,
    IRefreshTokenService refreshTokenService,
    IEmailSender emailSender,
    IOptions<FrontendOptions> frontendOptions,
    TimeProvider timeProvider,
    ILogger<AuthService> logger) : IAuthService
{
    private const string RefreshTokenReplacedReason = "Rotated";
    private const string RefreshTokenLogoutReason = "Logout";
    private const int AuthTokenByteLength = 64;
    private const string ForgotPasswordSuccessMessage =
        "If an account exists for that email, a password reset link has been sent.";
    private const string ResendEmailVerificationSuccessMessage =
        "If an account exists and needs email verification, a verification email has been sent.";
    private static readonly TimeSpan PasswordResetTokenLifetime = TimeSpan.FromHours(1);
    private static readonly TimeSpan EmailVerificationTokenLifetime = TimeSpan.FromHours(24);

    private readonly FrontendOptions frontendOptions = frontendOptions.Value;

    public async Task<AuthResponse> RegisterAsync(
        RegisterRequest request,
        CancellationToken cancellationToken)
    {
        string email = Clean(request.Email);
        string normalizedEmail = NormalizeEmail(email);
        string displayName = Clean(request.DisplayName);
        string heroName = Clean(request.HeroName);

        ValidateRegistration(email, request.Password, displayName, heroName);

        bool emailIsTaken = await dbContext.Users
            .AnyAsync(user => user.NormalizedEmail == normalizedEmail, cancellationToken);

        if (emailIsTaken)
        {
            throw new ApiException(
                StatusCodes.Status409Conflict,
                "Email already registered",
                "A user with this email address already exists.");
        }

        DateTimeOffset now = timeProvider.GetUtcNow();
        User user = new()
        {
            Email = email,
            NormalizedEmail = normalizedEmail,
            DisplayName = displayName,
            EmailConfirmed = false,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        user.PasswordHash = passwordHashService.HashPassword(user, request.Password);

        HeroProfile heroProfile = new()
        {
            User = user,
            HeroName = heroName,
            Level = 1,
            TotalXp = 0,
            CurrentStreak = 0,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        dbContext.Users.Add(user);
        dbContext.HeroProfiles.Add(heroProfile);
        CreatedAuthToken emailVerificationToken = CreateAuthToken(
            user.Id,
            AuthToken.EmailVerificationPurpose,
            now,
            EmailVerificationTokenLifetime);
        dbContext.AuthTokens.Add(emailVerificationToken.Entity);
        IssuedAuthSession session = IssueAuthSession(user, heroProfile);
        await dbContext.SaveChangesAsync(cancellationToken);

        string verificationUrl = BuildFrontendUrl(
            "verify-email",
            user.Email,
            emailVerificationToken.PlaintextToken);
        await TrySendEmailVerificationAsync(user.Email, verificationUrl);

        return session.Response;
    }

    public async Task<AuthResponse> LoginAsync(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        string normalizedEmail = NormalizeEmail(Clean(request.Email));

        User? user = await dbContext.Users
            .Include(candidate => candidate.HeroProfile)
            .SingleOrDefaultAsync(
                candidate => candidate.NormalizedEmail == normalizedEmail,
                cancellationToken);

        if (user?.HeroProfile is null)
        {
            throw InvalidCredentials();
        }

        PasswordVerificationOutcome passwordResult = passwordHashService.VerifyPassword(
            user,
            user.PasswordHash,
            request.Password);

        if (passwordResult == PasswordVerificationOutcome.Failed)
        {
            throw InvalidCredentials();
        }

        if (passwordResult == PasswordVerificationOutcome.SuccessRehashNeeded)
        {
            user.PasswordHash = passwordHashService.HashPassword(user, request.Password);
            user.UpdatedAtUtc = timeProvider.GetUtcNow();
        }

        IssuedAuthSession session = IssueAuthSession(user, user.HeroProfile);
        await dbContext.SaveChangesAsync(cancellationToken);

        return session.Response;
    }

    public async Task<AuthResponse> RefreshAsync(
        RefreshRequest request,
        CancellationToken cancellationToken)
    {
        RefreshToken refreshToken = await GetUsableRefreshTokenAsync(
            request.RefreshToken,
            cancellationToken);

        User user = refreshToken.User!;
        HeroProfile heroProfile = user.HeroProfile!;
        DateTimeOffset now = timeProvider.GetUtcNow();
        IssuedAuthSession session = IssueAuthSession(user, heroProfile);

        refreshToken.RevokedAtUtc = now;
        refreshToken.RevokedReason = RefreshTokenReplacedReason;
        refreshToken.ReplacedByTokenHash = session.RefreshToken.TokenHash;

        await dbContext.SaveChangesAsync(cancellationToken);

        return session.Response;
    }

    public async Task LogoutAsync(
        LogoutRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return;
        }

        string tokenHash = refreshTokenService.HashToken(request.RefreshToken);
        RefreshToken? refreshToken = await dbContext.RefreshTokens
            .SingleOrDefaultAsync(
                candidate => candidate.TokenHash == tokenHash,
                cancellationToken);

        if (refreshToken is null || refreshToken.RevokedAtUtc is not null)
        {
            return;
        }

        refreshToken.RevokedAtUtc = timeProvider.GetUtcNow();
        refreshToken.RevokedReason = RefreshTokenLogoutReason;

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<AuthMessageResponse> ForgotPasswordAsync(
        ForgotPasswordRequest request,
        CancellationToken cancellationToken)
    {
        string normalizedEmail = NormalizeEmail(Clean(request.Email));

        User? user = await dbContext.Users
            .SingleOrDefaultAsync(
                candidate => candidate.NormalizedEmail == normalizedEmail,
                cancellationToken);

        if (user is not null)
        {
            DateTimeOffset now = timeProvider.GetUtcNow();
            CreatedAuthToken passwordResetToken = CreateAuthToken(
                user.Id,
                AuthToken.PasswordResetPurpose,
                now,
                PasswordResetTokenLifetime);

            dbContext.AuthTokens.Add(passwordResetToken.Entity);
            await dbContext.SaveChangesAsync(cancellationToken);

            string resetUrl = BuildFrontendUrl(
                "reset-password",
                user.Email,
                passwordResetToken.PlaintextToken);
            await TrySendPasswordResetEmailAsync(user.Email, resetUrl);
        }

        return new AuthMessageResponse(ForgotPasswordSuccessMessage);
    }

    public async Task<AuthMessageResponse> ResetPasswordAsync(
        ResetPasswordRequest request,
        CancellationToken cancellationToken)
    {
        ValidatePassword(request.NewPassword);

        string normalizedEmail = NormalizeEmail(Clean(request.Email));
        User? user = await dbContext.Users
            .SingleOrDefaultAsync(
                candidate => candidate.NormalizedEmail == normalizedEmail,
                cancellationToken);

        if (user is null)
        {
            throw InvalidPasswordResetToken();
        }

        DateTimeOffset now = timeProvider.GetUtcNow();
        AuthToken authToken = await GetUsableAuthTokenAsync(
            user.Id,
            AuthToken.PasswordResetPurpose,
            request.Token,
            now,
            InvalidPasswordResetToken,
            cancellationToken);

        user.PasswordHash = passwordHashService.HashPassword(user, request.NewPassword);
        user.UpdatedAtUtc = now;
        authToken.UsedAtUtc = now;

        await MarkOtherUnusedTokensAsUsedAsync(
            user.Id,
            AuthToken.PasswordResetPurpose,
            authToken.Id,
            now,
            cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        return new AuthMessageResponse("Your password has been reset.");
    }

    public async Task<AuthMessageResponse> VerifyEmailAsync(
        VerifyEmailRequest request,
        CancellationToken cancellationToken)
    {
        string normalizedEmail = NormalizeEmail(Clean(request.Email));
        User? user = await dbContext.Users
            .SingleOrDefaultAsync(
                candidate => candidate.NormalizedEmail == normalizedEmail,
                cancellationToken);

        if (user is null)
        {
            throw InvalidEmailVerificationToken();
        }

        DateTimeOffset now = timeProvider.GetUtcNow();
        AuthToken authToken = await GetUsableAuthTokenAsync(
            user.Id,
            AuthToken.EmailVerificationPurpose,
            request.Token,
            now,
            InvalidEmailVerificationToken,
            cancellationToken);

        user.EmailConfirmed = true;
        user.EmailConfirmedAtUtc = now;
        user.UpdatedAtUtc = now;
        authToken.UsedAtUtc = now;

        await dbContext.SaveChangesAsync(cancellationToken);

        return new AuthMessageResponse("Your email has been verified.");
    }

    public async Task<AuthMessageResponse> ResendEmailVerificationAsync(
        ResendEmailVerificationRequest request,
        CancellationToken cancellationToken)
    {
        string normalizedEmail = NormalizeEmail(Clean(request.Email));
        User? user = await dbContext.Users
            .SingleOrDefaultAsync(
                candidate => candidate.NormalizedEmail == normalizedEmail,
                cancellationToken);

        if (user is not null && !user.EmailConfirmed)
        {
            DateTimeOffset now = timeProvider.GetUtcNow();
            CreatedAuthToken emailVerificationToken = CreateAuthToken(
                user.Id,
                AuthToken.EmailVerificationPurpose,
                now,
                EmailVerificationTokenLifetime);

            dbContext.AuthTokens.Add(emailVerificationToken.Entity);
            await dbContext.SaveChangesAsync(cancellationToken);

            string verificationUrl = BuildFrontendUrl(
                "verify-email",
                user.Email,
                emailVerificationToken.PlaintextToken);
            await TrySendEmailVerificationAsync(user.Email, verificationUrl);
        }

        return new AuthMessageResponse(ResendEmailVerificationSuccessMessage);
    }

    public async Task<MeResponse> GetCurrentUserAsync(
        ClaimsPrincipal principal,
        CancellationToken cancellationToken)
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

        User? user = await dbContext.Users
            .AsNoTracking()
            .Include(candidate => candidate.HeroProfile)
            .SingleOrDefaultAsync(candidate => candidate.Id == userId, cancellationToken);

        if (user?.HeroProfile is null)
        {
            throw new ApiException(
                StatusCodes.Status404NotFound,
                "User not found",
                "The current user could not be found.");
        }

        return new MeResponse(
            User: MapUser(user),
            HeroProfile: MapHeroProfile(user.HeroProfile));
    }

    private async Task<RefreshToken> GetUsableRefreshTokenAsync(
        string? plaintextRefreshToken,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(plaintextRefreshToken))
        {
            throw InvalidRefreshToken();
        }

        string tokenHash = refreshTokenService.HashToken(plaintextRefreshToken);
        RefreshToken? refreshToken = await dbContext.RefreshTokens
            .Include(candidate => candidate.User)
            .ThenInclude(user => user!.HeroProfile)
            .SingleOrDefaultAsync(
                candidate => candidate.TokenHash == tokenHash,
                cancellationToken);

        DateTimeOffset now = timeProvider.GetUtcNow();

        if (
            refreshToken?.User?.HeroProfile is null
            || refreshToken.RevokedAtUtc is not null
            || refreshToken.ExpiresAtUtc <= now)
        {
            throw InvalidRefreshToken();
        }

        return refreshToken;
    }

    private async Task<AuthToken> GetUsableAuthTokenAsync(
        Guid userId,
        string purpose,
        string plaintextToken,
        DateTimeOffset now,
        Func<ApiException> invalidTokenExceptionFactory,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(plaintextToken))
        {
            throw invalidTokenExceptionFactory();
        }

        string tokenHash = HashAuthToken(Clean(plaintextToken));
        AuthToken? authToken = await dbContext.AuthTokens
            .SingleOrDefaultAsync(
                candidate =>
                    candidate.UserId == userId
                    && candidate.Purpose == purpose
                    && candidate.TokenHash == tokenHash,
                cancellationToken);

        if (
            authToken is null
            || authToken.UsedAtUtc is not null
            || authToken.ExpiresAtUtc <= now)
        {
            throw invalidTokenExceptionFactory();
        }

        return authToken;
    }

    private async Task MarkOtherUnusedTokensAsUsedAsync(
        Guid userId,
        string purpose,
        Guid usedTokenId,
        DateTimeOffset usedAtUtc,
        CancellationToken cancellationToken)
    {
        List<AuthToken> otherUnusedTokens = await dbContext.AuthTokens
            .Where(authToken =>
                authToken.UserId == userId
                && authToken.Purpose == purpose
                && authToken.Id != usedTokenId
                && authToken.UsedAtUtc == null)
            .ToListAsync(cancellationToken);

        foreach (AuthToken otherToken in otherUnusedTokens)
        {
            otherToken.UsedAtUtc = usedAtUtc;
        }
    }

    private IssuedAuthSession IssueAuthSession(User user, HeroProfile heroProfile)
    {
        JwtToken token = jwtTokenService.CreateToken(user);
        CreatedRefreshToken refreshToken = refreshTokenService.CreateToken(user);
        dbContext.RefreshTokens.Add(refreshToken.Entity);

        AuthResponse response = new(
            AccessToken: token.AccessToken,
            ExpiresAtUtc: token.ExpiresAtUtc,
            RefreshToken: refreshToken.PlaintextToken,
            RefreshTokenExpiresAtUtc: refreshToken.Entity.ExpiresAtUtc,
            User: MapUser(user),
            HeroProfile: MapHeroProfile(heroProfile));

        return new IssuedAuthSession(response, refreshToken.Entity);
    }

    private CreatedAuthToken CreateAuthToken(
        Guid userId,
        string purpose,
        DateTimeOffset now,
        TimeSpan lifetime)
    {
        string plaintextToken = Base64UrlEncoder.Encode(
            RandomNumberGenerator.GetBytes(AuthTokenByteLength));

        AuthToken authToken = new()
        {
            UserId = userId,
            Purpose = purpose,
            TokenHash = HashAuthToken(plaintextToken),
            CreatedAtUtc = now,
            ExpiresAtUtc = now.Add(lifetime)
        };

        return new CreatedAuthToken(plaintextToken, authToken);
    }

    private string BuildFrontendUrl(
        string path,
        string email,
        string plaintextToken)
    {
        string baseUrl = GetFrontendBaseUrl();
        string encodedEmail = Uri.EscapeDataString(email);
        string encodedToken = Uri.EscapeDataString(plaintextToken);

        return $"{baseUrl}/{path}?email={encodedEmail}&token={encodedToken}";
    }

    private string GetFrontendBaseUrl()
    {
        if (string.IsNullOrWhiteSpace(frontendOptions.BaseUrl))
        {
            throw new InvalidOperationException("Frontend:BaseUrl is required.");
        }

        return frontendOptions.BaseUrl.Trim().TrimEnd('/');
    }

    private async Task TrySendPasswordResetEmailAsync(string toEmail, string resetUrl)
    {
        try
        {
            await emailSender.SendPasswordResetEmailAsync(toEmail, resetUrl);
        }
        catch (Exception exception)
        {
            logger.LogError(
                exception,
                "Failed to send password reset email to {ToEmail}.",
                toEmail);
        }
    }

    private async Task TrySendEmailVerificationAsync(
        string toEmail,
        string verificationUrl)
    {
        try
        {
            await emailSender.SendEmailVerificationAsync(toEmail, verificationUrl);
        }
        catch (Exception exception)
        {
            logger.LogError(
                exception,
                "Failed to send email verification to {ToEmail}.",
                toEmail);
        }
    }

    private static UserResponse MapUser(User user)
    {
        return new UserResponse(
            Id: user.Id,
            Email: user.Email,
            DisplayName: user.DisplayName,
            CreatedAtUtc: user.CreatedAtUtc);
    }

    private static HeroProfileResponse MapHeroProfile(HeroProfile heroProfile)
    {
        HeroProgress progress = HeroProgressCalculator.Calculate(heroProfile.TotalXp);

        return new HeroProfileResponse(
            Id: heroProfile.Id,
            HeroName: heroProfile.HeroName,
            Level: progress.Level,
            TotalXp: heroProfile.TotalXp,
            XpInCurrentLevel: progress.XpInCurrentLevel,
            XpRequiredForNextLevel: progress.XpRequiredForNextLevel,
            XpToNextLevel: progress.XpToNextLevel,
            CurrentStreak: heroProfile.CurrentStreak,
            CreatedAtUtc: heroProfile.CreatedAtUtc);
    }

    private static string Clean(string value) => value.Trim();

    private static string NormalizeEmail(string email)
    {
        return email.Trim().ToUpperInvariant();
    }

    private static string HashAuthToken(string plaintextToken)
    {
        byte[] tokenBytes = Encoding.UTF8.GetBytes(plaintextToken);
        byte[] hashBytes = SHA256.HashData(tokenBytes);

        return Convert.ToHexString(hashBytes);
    }

    private static void ValidateRegistration(
        string email,
        string password,
        string displayName,
        string heroName)
    {
        Dictionary<string, string[]> errors = [];

        if (string.IsNullOrWhiteSpace(email))
        {
            errors[nameof(RegisterRequest.Email)] = ["Email is required."];
        }

        if (string.IsNullOrWhiteSpace(password) || password.Length < 8)
        {
            errors[nameof(RegisterRequest.Password)] = ["Password must be at least 8 characters long."];
        }

        if (string.IsNullOrWhiteSpace(displayName) || displayName.Length < 2)
        {
            errors[nameof(RegisterRequest.DisplayName)] = ["Display name must be at least 2 characters long."];
        }

        if (string.IsNullOrWhiteSpace(heroName) || heroName.Length < 2)
        {
            errors[nameof(RegisterRequest.HeroName)] = ["Hero name must be at least 2 characters long."];
        }

        if (errors.Count > 0)
        {
            throw new ApiValidationException(errors);
        }
    }

    private static void ValidatePassword(string password)
    {
        Dictionary<string, string[]> errors = [];

        if (string.IsNullOrWhiteSpace(password) || password.Length < 8)
        {
            errors[nameof(ResetPasswordRequest.NewPassword)] =
                ["Password must be at least 8 characters long."];
        }

        if (errors.Count > 0)
        {
            throw new ApiValidationException(errors);
        }
    }

    private static ApiException InvalidCredentials()
    {
        return new ApiException(
            StatusCodes.Status401Unauthorized,
            "Invalid credentials",
            "Email or password was not recognized.");
    }

    private static ApiException InvalidRefreshToken()
    {
        return new ApiException(
            StatusCodes.Status401Unauthorized,
            "Invalid refresh token",
            "The refresh token is invalid or expired.");
    }

    private static ApiException InvalidPasswordResetToken()
    {
        return new ApiException(
            StatusCodes.Status400BadRequest,
            "Invalid password reset token",
            "The password reset token is invalid or expired.");
    }

    private static ApiException InvalidEmailVerificationToken()
    {
        return new ApiException(
            StatusCodes.Status400BadRequest,
            "Invalid email verification token",
            "The email verification token is invalid or expired.");
    }

    private sealed record IssuedAuthSession(
        AuthResponse Response,
        RefreshToken RefreshToken);

    private sealed record CreatedAuthToken(
        string PlaintextToken,
        AuthToken Entity);
}
