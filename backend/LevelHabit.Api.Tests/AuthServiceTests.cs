using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using LevelHabit.Api.Auth;
using LevelHabit.Api.Contracts.Auth;
using LevelHabit.Api.Data;
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
    public async Task RegisterAsync_creates_user_hero_profile_and_token()
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

        Assert.Equal(1, await harness.DbContext.Users.CountAsync());
        Assert.Equal(1, await harness.DbContext.HeroProfiles.CountAsync());
    }

    [Fact]
    public async Task LoginAsync_returns_token_and_profile_for_valid_credentials()
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
        ClaimsPrincipal principal = harness.ValidateAccessToken(login.AccessToken);
        Assert.Equal(login.User.Id.ToString(), principal.FindFirstValue(ClaimTypes.NameIdentifier));
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
    public async Task GetCurrentUserAsync_returns_registered_user_and_profile()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();

        AuthResponse registration = await harness.Service.RegisterAsync(
            new RegisterRequest(
                Email: "player@example.com",
                Password: "CorrectHorse123!",
                DisplayName: "Player One",
                HeroName: "Morning Warden"),
            CancellationToken.None);

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

        AuthResponse registration = await harness.Service.RegisterAsync(
            new RegisterRequest(
                Email: "player@example.com",
                Password: "CorrectHorse123!",
                DisplayName: "Player One",
                HeroName: "Morning Warden"),
            CancellationToken.None);

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
            JwtOptions jwtOptions)
        {
            DbContext = dbContext;
            Service = service;
            JwtOptions = jwtOptions;
        }

        public LevelHabitDbContext DbContext { get; }

        public IAuthService Service { get; }

        public JwtOptions JwtOptions { get; }

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
                Secret = "test-secret-for-levelhabit-auth-tests"
            };

            JwtTokenService tokenService = new(
                Options.Create(jwtOptions),
                TimeProvider.System);

            AuthService service = new(
                dbContext,
                new PasswordHashService(),
                tokenService,
                TimeProvider.System);

            return new AuthServiceHarness(dbContext, service, jwtOptions);
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

        public void Dispose()
        {
            DbContext.Dispose();
        }
    }
}
