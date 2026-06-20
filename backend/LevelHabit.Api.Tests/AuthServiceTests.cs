using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using LevelHabit.Api.Auth;
using LevelHabit.Api.Contracts.Auth;
using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using LevelHabit.Api.Middleware;
using LevelHabit.Api.Services.Auth;
using LevelHabit.Api.Services.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace LevelHabit.Api.Tests;

public sealed class AuthServiceTests
{
    [Fact]
    public async Task RegisterAsync_creates_user_hero_profile_and_tokens()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();

        AuthResponse response = await harness.Service.RegisterAsync(
            new RegisterRequest(
                Email: " player@example.com ",
                Password: "CorrectHorse123!",
                DisplayName: "Player One",
                HeroName: "Morning Warden"),
            CancellationToken.None);

        Assert.NotEqual(Guid.Empty, response.User.Id);
        Assert.Equal("player@example.com", response.User.Email);
        Assert.Equal("Player One", response.User.DisplayName);
        Assert.Equal("Morning Warden", response.HeroProfile.HeroName);
        Assert.Equal(1, response.HeroProfile.Level);
        Assert.Equal(0, response.HeroProfile.TotalXp);
        Assert.Equal(0, response.HeroProfile.CurrentStreak);
        Assert.False(string.IsNullOrWhiteSpace(response.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(response.RefreshToken));
        Assert.True(response.RefreshTokenExpiresAtUtc > response.ExpiresAtUtc);

        Assert.Equal(1, await harness.DbContext.Users.CountAsync());
        Assert.Equal(1, await harness.DbContext.HeroProfiles.CountAsync());

        RefreshToken refreshToken = Assert.Single(
            await harness.DbContext.RefreshTokens.ToListAsync());
        Assert.Equal(response.User.Id, refreshToken.UserId);
        Assert.Equal(
            harness.HashRefreshToken(response.RefreshToken),
            refreshToken.TokenHash);
        Assert.NotEqual(response.RefreshToken, refreshToken.TokenHash);
        Assert.Null(refreshToken.RevokedAtUtc);
    }

    [Fact]
    public async Task LoginAsync_returns_tokens_and_profile_for_valid_credentials()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();

        await harness.Service.RegisterAsync(
            new RegisterRequest(
                Email: "player@example.com",
                Password: "CorrectHorse123!",
                DisplayName: "Player One",
                HeroName: "Morning Warden"),
            CancellationToken.None);

        AuthResponse login = await harness.Service.LoginAsync(
            new LoginRequest(
                Email: "PLAYER@example.com",
                Password: "CorrectHorse123!"),
            CancellationToken.None);

        Assert.Equal("player@example.com", login.User.Email);
        Assert.Equal("Morning Warden", login.HeroProfile.HeroName);
        Assert.False(string.IsNullOrWhiteSpace(login.RefreshToken));
        ClaimsPrincipal principal = harness.ValidateAccessToken(login.AccessToken);
        Assert.Equal(login.User.Id.ToString(), principal.FindFirstValue(ClaimTypes.NameIdentifier));
        Assert.Equal(2, await harness.DbContext.RefreshTokens.CountAsync());
    }

    [Fact]
    public async Task LoginAsync_rejects_invalid_password()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();

        await harness.Service.RegisterAsync(
            new RegisterRequest(
                Email: "player@example.com",
                Password: "CorrectHorse123!",
                DisplayName: "Player One",
                HeroName: "Morning Warden"),
            CancellationToken.None);

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.LoginAsync(
                new LoginRequest(
                    Email: "player@example.com",
                    Password: "wrong-password"),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status401Unauthorized, exception.StatusCode);
    }

    [Fact]
    public async Task RefreshAsync_returns_new_access_and_refresh_tokens()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        AuthResponse registration = await harness.RegisterDefaultAsync();

        AuthResponse refresh = await harness.Service.RefreshAsync(
            new RefreshRequest(registration.RefreshToken),
            CancellationToken.None);

        Assert.NotEqual(registration.AccessToken, refresh.AccessToken);
        Assert.NotEqual(registration.RefreshToken, refresh.RefreshToken);
        Assert.Equal(registration.User.Id, refresh.User.Id);
        ClaimsPrincipal principal = harness.ValidateAccessToken(refresh.AccessToken);
        Assert.Equal(refresh.User.Id.ToString(), principal.FindFirstValue(ClaimTypes.NameIdentifier));
    }

    [Fact]
    public async Task RefreshAsync_rotates_the_refresh_token()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        AuthResponse registration = await harness.RegisterDefaultAsync();

        AuthResponse refresh = await harness.Service.RefreshAsync(
            new RefreshRequest(registration.RefreshToken),
            CancellationToken.None);

        RefreshToken oldToken = await harness.FindRefreshTokenAsync(
            registration.RefreshToken);
        RefreshToken newToken = await harness.FindRefreshTokenAsync(refresh.RefreshToken);

        Assert.NotNull(oldToken.RevokedAtUtc);
        Assert.Equal("Rotated", oldToken.RevokedReason);
        Assert.Equal(newToken.TokenHash, oldToken.ReplacedByTokenHash);
        Assert.Null(newToken.RevokedAtUtc);
    }

    [Fact]
    public async Task RefreshAsync_rejects_old_rotated_refresh_token()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        AuthResponse registration = await harness.RegisterDefaultAsync();

        await harness.Service.RefreshAsync(
            new RefreshRequest(registration.RefreshToken),
            CancellationToken.None);

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.RefreshAsync(
                new RefreshRequest(registration.RefreshToken),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status401Unauthorized, exception.StatusCode);
    }

    [Fact]
    public async Task RefreshAsync_rejects_expired_refresh_token()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        AuthResponse registration = await harness.RegisterDefaultAsync();
        harness.Advance(TimeSpan.FromDays(harness.JwtOptions.RefreshTokenExpirationDays + 1));

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.RefreshAsync(
                new RefreshRequest(registration.RefreshToken),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status401Unauthorized, exception.StatusCode);
    }

    [Fact]
    public async Task RefreshAsync_rejects_revoked_refresh_token()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        AuthResponse registration = await harness.RegisterDefaultAsync();
        RefreshToken refreshToken = await harness.FindRefreshTokenAsync(
            registration.RefreshToken);
        refreshToken.RevokedAtUtc = harness.TimeProvider.GetUtcNow();
        refreshToken.RevokedReason = "Test revocation";
        await harness.DbContext.SaveChangesAsync();

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.RefreshAsync(
                new RefreshRequest(registration.RefreshToken),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status401Unauthorized, exception.StatusCode);
    }

    [Fact]
    public async Task LogoutAsync_revokes_refresh_token()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        AuthResponse registration = await harness.RegisterDefaultAsync();

        await harness.Service.LogoutAsync(
            new LogoutRequest(registration.RefreshToken),
            CancellationToken.None);

        RefreshToken refreshToken = await harness.FindRefreshTokenAsync(
            registration.RefreshToken);
        Assert.NotNull(refreshToken.RevokedAtUtc);
        Assert.Equal("Logout", refreshToken.RevokedReason);

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.RefreshAsync(
                new RefreshRequest(registration.RefreshToken),
                CancellationToken.None));
        Assert.Equal(StatusCodes.Status401Unauthorized, exception.StatusCode);
    }

    [Fact]
    public async Task GetCurrentUserAsync_returns_registered_user_and_profile()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();

        AuthResponse registration = await harness.RegisterDefaultAsync();

        ClaimsPrincipal principal = new(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, registration.User.Id.ToString())],
            authenticationType: "Test"));

        MeResponse me = await harness.Service.GetCurrentUserAsync(
            principal,
            CancellationToken.None);

        Assert.Equal(registration.User.Id, me.User.Id);
        Assert.Equal(registration.HeroProfile.Id, me.HeroProfile.Id);
        Assert.Equal("Morning Warden", me.HeroProfile.HeroName);
    }

    [Fact]
    public async Task GetCurrentUserAsync_returns_user_and_profile_from_valid_jwt()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();

        AuthResponse registration = await harness.RegisterDefaultAsync();

        ClaimsPrincipal principal = harness.ValidateAccessToken(registration.AccessToken);

        MeResponse me = await harness.Service.GetCurrentUserAsync(
            principal,
            CancellationToken.None);

        Assert.Equal(registration.User.Id, me.User.Id);
        Assert.Equal("player@example.com", me.User.Email);
        Assert.Equal("Morning Warden", me.HeroProfile.HeroName);
    }

    private sealed class AuthServiceHarness : IDisposable
    {
        private AuthServiceHarness(
            LevelHabitDbContext dbContext,
            IAuthService service,
            IRefreshTokenService refreshTokenService,
            JwtOptions jwtOptions,
            MutableTimeProvider timeProvider)
        {
            DbContext = dbContext;
            Service = service;
            RefreshTokenService = refreshTokenService;
            JwtOptions = jwtOptions;
            TimeProvider = timeProvider;
        }

        public LevelHabitDbContext DbContext { get; }

        public IAuthService Service { get; }

        public IRefreshTokenService RefreshTokenService { get; }

        public JwtOptions JwtOptions { get; }

        public MutableTimeProvider TimeProvider { get; }

        public static AuthServiceHarness Create()
        {
            DbContextOptions<LevelHabitDbContext> options = new DbContextOptionsBuilder<LevelHabitDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;

            LevelHabitDbContext dbContext = new(options);
            JwtOptions jwtOptions = new()
            {
                Issuer = "LevelHabit.Api.Tests",
                Audience = "LevelHabit.Api.Tests",
                ExpirationMinutes = 60,
                RefreshTokenExpirationDays = 7,
                Secret = "test-secret-for-levelhabit-auth-tests"
            };
            MutableTimeProvider timeProvider = new(global::System.TimeProvider.System.GetUtcNow());

            JwtTokenService tokenService = new(
                Options.Create(jwtOptions),
                timeProvider);
            RefreshTokenService refreshTokenService = new(
                Options.Create(jwtOptions),
                timeProvider);

            AuthService service = new(
                dbContext,
                new PasswordHashService(),
                tokenService,
                refreshTokenService,
                timeProvider);

            return new AuthServiceHarness(
                dbContext,
                service,
                refreshTokenService,
                jwtOptions,
                timeProvider);
        }

        public Task<AuthResponse> RegisterDefaultAsync()
        {
            return Service.RegisterAsync(
                new RegisterRequest(
                    Email: "player@example.com",
                    Password: "CorrectHorse123!",
                    DisplayName: "Player One",
                    HeroName: "Morning Warden"),
                CancellationToken.None);
        }

        public string HashRefreshToken(string refreshToken)
        {
            return RefreshTokenService.HashToken(refreshToken);
        }

        public Task<RefreshToken> FindRefreshTokenAsync(string plaintextRefreshToken)
        {
            string tokenHash = HashRefreshToken(plaintextRefreshToken);

            return DbContext.RefreshTokens.SingleAsync(
                refreshToken => refreshToken.TokenHash == tokenHash);
        }

        public ClaimsPrincipal ValidateAccessToken(string accessToken)
        {
            TokenValidationParameters validationParameters = new()
            {
                ValidateIssuer = true,
                ValidIssuer = JwtOptions.Issuer,
                ValidateAudience = true,
                ValidAudience = JwtOptions.Audience,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(
                    Encoding.UTF8.GetBytes(JwtOptions.Secret!)),
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromMinutes(1)
            };

            return new JwtSecurityTokenHandler().ValidateToken(
                accessToken,
                validationParameters,
                out _);
        }

        public void Advance(TimeSpan interval)
        {
            TimeProvider.Advance(interval);
        }

        public void Dispose()
        {
            DbContext.Dispose();
        }
    }

    private sealed class MutableTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        private DateTimeOffset utcNow = utcNow;

        public override DateTimeOffset GetUtcNow() => utcNow;

        public void Advance(TimeSpan interval)
        {
            utcNow += interval;
        }
    }
}
