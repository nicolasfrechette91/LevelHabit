using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using LevelHabit.Api.Auth;
using LevelHabit.Api.Contracts.Auth;
using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using LevelHabit.Api.Middleware;
using LevelHabit.Api.Services.Auth;
using LevelHabit.Api.Services.Email;
using LevelHabit.Api.Services.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
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
        User user = await harness.DbContext.Users.SingleAsync();
        Assert.False(user.EmailConfirmed);
        Assert.Null(user.EmailConfirmedAtUtc);

        RefreshToken refreshToken = Assert.Single(
            await harness.DbContext.RefreshTokens.ToListAsync());
        Assert.Equal(response.User.Id, refreshToken.UserId);
        Assert.Equal(
            harness.HashRefreshToken(response.RefreshToken),
            refreshToken.TokenHash);
        Assert.NotEqual(response.RefreshToken, refreshToken.TokenHash);
        Assert.Null(refreshToken.RevokedAtUtc);

        AuthToken verificationToken = Assert.Single(
            await harness.DbContext.AuthTokens
                .Where(authToken => authToken.Purpose == AuthToken.EmailVerificationPurpose)
                .ToListAsync());
        Assert.Equal(response.User.Id, verificationToken.UserId);
        Assert.Equal(64, verificationToken.TokenHash.Length);
        Assert.Equal(
            TimeSpan.FromHours(24),
            verificationToken.ExpiresAtUtc - verificationToken.CreatedAtUtc);
        Assert.Single(harness.EmailSender.EmailVerificationEmails);
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
    public async Task ForgotPasswordAsync_returns_generic_success_when_email_does_not_exist()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();

        AuthMessageResponse response = await harness.Service.ForgotPasswordAsync(
            new ForgotPasswordRequest("missing@example.com"),
            CancellationToken.None);

        Assert.Equal(
            "If an account exists for that email, a password reset link has been sent.",
            response.Message);
        Assert.Empty(await harness.DbContext.AuthTokens.ToListAsync());
        Assert.Empty(harness.EmailSender.PasswordResetEmails);
    }

    [Fact]
    public async Task ForgotPasswordAsync_creates_password_reset_token_for_existing_user()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        AuthResponse registration = await harness.RegisterDefaultAsync();

        AuthMessageResponse response = await harness.Service.ForgotPasswordAsync(
            new ForgotPasswordRequest("PLAYER@example.com"),
            CancellationToken.None);

        Assert.Equal(
            "If an account exists for that email, a password reset link has been sent.",
            response.Message);

        AuthToken passwordResetToken = Assert.Single(
            await harness.DbContext.AuthTokens
                .Where(authToken => authToken.Purpose == AuthToken.PasswordResetPurpose)
                .ToListAsync());
        string plaintextToken = harness.LastPasswordResetToken();

        Assert.Equal(registration.User.Id, passwordResetToken.UserId);
        Assert.Equal(harness.HashAuthToken(plaintextToken), passwordResetToken.TokenHash);
        Assert.NotEqual(plaintextToken, passwordResetToken.TokenHash);
        Assert.Equal(64, passwordResetToken.TokenHash.Length);
        Assert.Equal(
            TimeSpan.FromHours(1),
            passwordResetToken.ExpiresAtUtc - passwordResetToken.CreatedAtUtc);
    }

    [Fact]
    public async Task ResetPasswordAsync_succeeds_with_valid_token()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        await harness.RegisterDefaultAsync();
        await harness.Service.ForgotPasswordAsync(
            new ForgotPasswordRequest("player@example.com"),
            CancellationToken.None);
        await harness.Service.ForgotPasswordAsync(
            new ForgotPasswordRequest("player@example.com"),
            CancellationToken.None);
        string plaintextToken = harness.LastPasswordResetToken();

        AuthMessageResponse response = await harness.Service.ResetPasswordAsync(
            new ResetPasswordRequest(
                Email: "player@example.com",
                Token: plaintextToken,
                NewPassword: "NewCorrectHorse123!"),
            CancellationToken.None);

        Assert.Equal("Your password has been reset.", response.Message);
        AuthToken usedToken = await harness.FindAuthTokenAsync(plaintextToken);
        Assert.NotNull(usedToken.UsedAtUtc);
        Assert.All(
            await harness.DbContext.AuthTokens
                .Where(authToken => authToken.Purpose == AuthToken.PasswordResetPurpose)
                .ToListAsync(),
            authToken => Assert.NotNull(authToken.UsedAtUtc));

        AuthResponse login = await harness.Service.LoginAsync(
            new LoginRequest(
                Email: "player@example.com",
                Password: "NewCorrectHorse123!"),
            CancellationToken.None);
        Assert.Equal("player@example.com", login.User.Email);
    }

    [Fact]
    public async Task ResetPasswordAsync_fails_with_invalid_token()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        await harness.RegisterDefaultAsync();
        await harness.Service.ForgotPasswordAsync(
            new ForgotPasswordRequest("player@example.com"),
            CancellationToken.None);

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.ResetPasswordAsync(
                new ResetPasswordRequest(
                    Email: "player@example.com",
                    Token: "not-the-token",
                    NewPassword: "NewCorrectHorse123!"),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status400BadRequest, exception.StatusCode);
    }

    [Fact]
    public async Task ResetPasswordAsync_fails_with_expired_token()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        await harness.RegisterDefaultAsync();
        await harness.Service.ForgotPasswordAsync(
            new ForgotPasswordRequest("player@example.com"),
            CancellationToken.None);
        string plaintextToken = harness.LastPasswordResetToken();
        harness.Advance(TimeSpan.FromHours(1).Add(TimeSpan.FromSeconds(1)));

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.ResetPasswordAsync(
                new ResetPasswordRequest(
                    Email: "player@example.com",
                    Token: plaintextToken,
                    NewPassword: "NewCorrectHorse123!"),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status400BadRequest, exception.StatusCode);
    }

    [Fact]
    public async Task ResetPasswordAsync_fails_with_already_used_token()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        await harness.RegisterDefaultAsync();
        await harness.Service.ForgotPasswordAsync(
            new ForgotPasswordRequest("player@example.com"),
            CancellationToken.None);
        string plaintextToken = harness.LastPasswordResetToken();

        await harness.Service.ResetPasswordAsync(
            new ResetPasswordRequest(
                Email: "player@example.com",
                Token: plaintextToken,
                NewPassword: "NewCorrectHorse123!"),
            CancellationToken.None);

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.ResetPasswordAsync(
                new ResetPasswordRequest(
                    Email: "player@example.com",
                    Token: plaintextToken,
                    NewPassword: "AnotherCorrectHorse123!"),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status400BadRequest, exception.StatusCode);
    }

    [Fact]
    public async Task VerifyEmailAsync_succeeds_with_valid_token()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        AuthResponse registration = await harness.RegisterDefaultAsync();
        string plaintextToken = harness.LastEmailVerificationToken();

        AuthMessageResponse response = await harness.Service.VerifyEmailAsync(
            new VerifyEmailRequest(
                Email: "PLAYER@example.com",
                Token: plaintextToken),
            CancellationToken.None);

        User user = await harness.DbContext.Users.SingleAsync();
        AuthToken authToken = await harness.FindAuthTokenAsync(plaintextToken);

        Assert.Equal("Your email has been verified.", response.Message);
        Assert.Equal(registration.User.Id, user.Id);
        Assert.True(user.EmailConfirmed);
        Assert.NotNull(user.EmailConfirmedAtUtc);
        Assert.NotNull(authToken.UsedAtUtc);
    }

    [Fact]
    public async Task VerifyEmailAsync_fails_with_invalid_token()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        await harness.RegisterDefaultAsync();

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.VerifyEmailAsync(
                new VerifyEmailRequest(
                    Email: "player@example.com",
                    Token: "not-the-token"),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status400BadRequest, exception.StatusCode);
    }

    [Fact]
    public async Task VerifyEmailAsync_fails_with_expired_token()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        await harness.RegisterDefaultAsync();
        string plaintextToken = harness.LastEmailVerificationToken();
        harness.Advance(TimeSpan.FromHours(24).Add(TimeSpan.FromSeconds(1)));

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.VerifyEmailAsync(
                new VerifyEmailRequest(
                    Email: "player@example.com",
                    Token: plaintextToken),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status400BadRequest, exception.StatusCode);
    }

    [Fact]
    public async Task VerifyEmailAsync_fails_with_already_used_token()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        await harness.RegisterDefaultAsync();
        string plaintextToken = harness.LastEmailVerificationToken();

        await harness.Service.VerifyEmailAsync(
            new VerifyEmailRequest(
                Email: "player@example.com",
                Token: plaintextToken),
            CancellationToken.None);

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.VerifyEmailAsync(
                new VerifyEmailRequest(
                    Email: "player@example.com",
                    Token: plaintextToken),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status400BadRequest, exception.StatusCode);
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
            TestEmailSender emailSender,
            JwtOptions jwtOptions,
            MutableTimeProvider timeProvider)
        {
            DbContext = dbContext;
            Service = service;
            RefreshTokenService = refreshTokenService;
            EmailSender = emailSender;
            JwtOptions = jwtOptions;
            TimeProvider = timeProvider;
        }

        public LevelHabitDbContext DbContext { get; }

        public IAuthService Service { get; }

        public IRefreshTokenService RefreshTokenService { get; }

        public TestEmailSender EmailSender { get; }

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
            TestEmailSender emailSender = new();

            AuthService service = new(
                dbContext,
                new PasswordHashService(),
                tokenService,
                refreshTokenService,
                emailSender,
                Options.Create(new FrontendOptions
                {
                    BaseUrl = "https://levelhabit.example"
                }),
                timeProvider,
                NullLogger<AuthService>.Instance);

            return new AuthServiceHarness(
                dbContext,
                service,
                refreshTokenService,
                emailSender,
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

        public string HashAuthToken(string plaintextToken)
        {
            byte[] tokenBytes = Encoding.UTF8.GetBytes(plaintextToken);
            byte[] hashBytes = SHA256.HashData(tokenBytes);

            return Convert.ToHexString(hashBytes);
        }

        public Task<RefreshToken> FindRefreshTokenAsync(string plaintextRefreshToken)
        {
            string tokenHash = HashRefreshToken(plaintextRefreshToken);

            return DbContext.RefreshTokens.SingleAsync(
                refreshToken => refreshToken.TokenHash == tokenHash);
        }

        public Task<AuthToken> FindAuthTokenAsync(string plaintextAuthToken)
        {
            string tokenHash = HashAuthToken(plaintextAuthToken);

            return DbContext.AuthTokens.SingleAsync(
                authToken => authToken.TokenHash == tokenHash);
        }

        public string LastPasswordResetToken()
        {
            return ReadTokenQueryValue(EmailSender.PasswordResetEmails.Last().ResetUrl);
        }

        public string LastEmailVerificationToken()
        {
            return ReadTokenQueryValue(
                EmailSender.EmailVerificationEmails.Last().VerificationUrl);
        }

        private static string ReadTokenQueryValue(string url)
        {
            Uri uri = new(url);
            string query = uri.Query.TrimStart('?');

            foreach (string part in query.Split(
                '&',
                StringSplitOptions.RemoveEmptyEntries))
            {
                string[] keyValue = part.Split('=', 2);

                if (
                    keyValue.Length == 2
                    && string.Equals(keyValue[0], "token", StringComparison.Ordinal))
                {
                    return Uri.UnescapeDataString(keyValue[1]);
                }
            }

            throw new InvalidOperationException("Token query value was not found.");
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

    private sealed class TestEmailSender : IEmailSender
    {
        public List<PasswordResetEmail> PasswordResetEmails { get; } = [];

        public List<EmailVerificationEmail> EmailVerificationEmails { get; } = [];

        public Task SendPasswordResetEmailAsync(string toEmail, string resetUrl)
        {
            PasswordResetEmails.Add(new PasswordResetEmail(toEmail, resetUrl));

            return Task.CompletedTask;
        }

        public Task SendEmailVerificationAsync(
            string toEmail,
            string verificationUrl)
        {
            EmailVerificationEmails.Add(
                new EmailVerificationEmail(toEmail, verificationUrl));

            return Task.CompletedTask;
        }
    }

    private sealed record PasswordResetEmail(string ToEmail, string ResetUrl);

    private sealed record EmailVerificationEmail(
        string ToEmail,
        string VerificationUrl);
}
