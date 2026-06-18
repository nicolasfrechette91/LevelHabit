using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using LevelHabit.Api.Contracts.Auth;
using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using LevelHabit.Api.Middleware;
using LevelHabit.Api.Services.Security;
using Microsoft.EntityFrameworkCore;

namespace LevelHabit.Api.Services.Auth;

public sealed class AuthService(
    LevelHabitDbContext dbContext,
    IPasswordHashService passwordHashService,
    IJwtTokenService jwtTokenService,
    TimeProvider timeProvider) : IAuthService
{
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
        await dbContext.SaveChangesAsync(cancellationToken);

        return CreateAuthResponse(user, heroProfile);
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
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return CreateAuthResponse(user, user.HeroProfile);
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

    private AuthResponse CreateAuthResponse(User user, HeroProfile heroProfile)
    {
        JwtToken token = jwtTokenService.CreateToken(user);

        return new AuthResponse(
            AccessToken: token.AccessToken,
            ExpiresAtUtc: token.ExpiresAtUtc,
            User: MapUser(user),
            HeroProfile: MapHeroProfile(heroProfile));
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
        return new HeroProfileResponse(
            Id: heroProfile.Id,
            HeroName: heroProfile.HeroName,
            Level: heroProfile.Level,
            TotalXp: heroProfile.TotalXp,
            CurrentStreak: heroProfile.CurrentStreak,
            CreatedAtUtc: heroProfile.CreatedAtUtc);
    }

    private static string Clean(string value) => value.Trim();

    private static string NormalizeEmail(string email)
    {
        return email.Trim().ToUpperInvariant();
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

    private static ApiException InvalidCredentials()
    {
        return new ApiException(
            StatusCodes.Status401Unauthorized,
            "Invalid credentials",
            "Email or password was not recognized.");
    }
}
