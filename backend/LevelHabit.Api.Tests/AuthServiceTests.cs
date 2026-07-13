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
    public async Task RegisterAsync_creates_unconfirmed_user_hero_profile_and_verification_code()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        DateTimeOffset now = harness.TimeProvider.GetUtcNow();

        RegisterResponse response = await harness.Service.RegisterAsync(
            new RegisterRequest(
                Email: " player@example.com ",
                Password: "CorrectHorse123!",
                DisplayName: "Player One",
                HeroName: "Morning Warden"),
            CancellationToken.None);

        Assert.Equal("player@example.com", response.Email);
        Assert.True(response.RequiresEmailVerification);
        Assert.Equal(
            "Account created. Enter the verification code sent to your email.",
            response.Message);
        Assert.DoesNotContain(
            typeof(RegisterResponse).GetProperties(),
            property => property.Name.Contains("Token", StringComparison.Ordinal));

        Assert.Equal(1, await harness.DbContext.Users.CountAsync());
        Assert.Equal(1, await harness.DbContext.HeroProfiles.CountAsync());
        Assert.Empty(await harness.DbContext.RefreshTokens.ToListAsync());
        Assert.Empty(await harness.DbContext.AuthTokens.ToListAsync());

        User user = await harness.DbContext.Users
            .Include(candidate => candidate.HeroProfile)
            .SingleAsync();

        Assert.Equal("player@example.com", user.Email);
        Assert.Equal("PLAYER@EXAMPLE.COM", user.NormalizedEmail);
        Assert.Equal("Player One", user.DisplayName);
        Assert.False(user.EmailConfirmed);
        Assert.Null(user.EmailConfirmedAtUtc);
        Assert.NotNull(user.EmailVerificationCodeHash);
        Assert.Equal(
            harness.HashVerificationCode(user.NormalizedEmail, "123456"),
            user.EmailVerificationCodeHash);
        Assert.NotEqual("123456", user.EmailVerificationCodeHash);
        Assert.Equal(
            now.AddMinutes(harness.EmailVerificationOptions.CodeExpirationMinutes),
            user.EmailVerificationCodeExpiresAtUtc);
        Assert.Equal(now, user.EmailVerificationCodeLastSentAtUtc);
        Assert.Equal(0, user.EmailVerificationFailedAttempts);
        Assert.NotNull(user.HeroProfile);
        Assert.Equal("Morning Warden", user.HeroProfile.HeroName);

        EmailVerificationEmail email = Assert.Single(
            harness.EmailSender.EmailVerificationEmails);
        Assert.Equal("player@example.com", email.ToEmail);
        Assert.Equal("123456", email.VerificationCode);
        Assert.Equal(TimeSpan.FromMinutes(10), email.ExpiresIn);
    }

    [Fact]
    public async Task LoginAsync_rejects_unconfirmed_user_without_issuing_tokens()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        await harness.RegisterDefaultAsync();

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.LoginAsync(
                new LoginRequest(
                    Email: "player@example.com",
                    Password: "CorrectHorse123!"),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status403Forbidden, exception.StatusCode);
        Assert.Equal("EMAIL_NOT_CONFIRMED", exception.Code);
        Assert.Empty(await harness.DbContext.RefreshTokens.ToListAsync());
    }

    [Fact]
    public async Task LoginAsync_returns_tokens_and_profile_after_confirmation()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        await harness.RegisterAndConfirmDefaultAsync();

        AuthResponse login = await harness.Service.LoginAsync(
            new LoginRequest(
                Email: "PLAYER@example.com",
                Password: "CorrectHorse123!"),
            CancellationToken.None);

        Assert.Equal("player@example.com", login.User.Email);
        Assert.Equal("Morning Warden", login.HeroProfile.HeroName);
        Assert.False(string.IsNullOrWhiteSpace(login.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(login.RefreshToken));
        ClaimsPrincipal principal = harness.ValidateAccessToken(login.AccessToken);
        Assert.Equal(login.User.Id.ToString(), principal.FindFirstValue(ClaimTypes.NameIdentifier));
        Assert.Single(await harness.DbContext.RefreshTokens.ToListAsync());
    }

    [Fact]
    public async Task LoginAsync_rejects_invalid_password()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        await harness.RegisterAndConfirmDefaultAsync();

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.LoginAsync(
                new LoginRequest(
                    Email: "player@example.com",
                    Password: "wrong-password"),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status401Unauthorized, exception.StatusCode);
    }

    [Fact]
    public async Task ConfirmEmailAsync_succeeds_with_correct_code()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        await harness.RegisterDefaultAsync();
        string code = harness.LastEmailVerificationCode();

        AuthMessageResponse response = await harness.Service.ConfirmEmailAsync(
            new ConfirmEmailRequest(
                Email: "PLAYER@example.com",
                Code: code),
            CancellationToken.None);

        User user = await harness.DbContext.Users.SingleAsync();

        Assert.Equal("Your email has been confirmed successfully.", response.Message);
        Assert.True(user.EmailConfirmed);
        Assert.NotNull(user.EmailConfirmedAtUtc);
        Assert.Null(user.EmailVerificationCodeHash);
        Assert.Null(user.EmailVerificationCodeExpiresAtUtc);
        Assert.Equal(0, user.EmailVerificationFailedAttempts);
    }

    [Fact]
    public async Task ConfirmEmailAsync_accepts_code_beginning_with_zero()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        harness.QueueVerificationCode("004827");
        await harness.RegisterDefaultAsync();

        await harness.Service.ConfirmEmailAsync(
            new ConfirmEmailRequest(
                Email: "player@example.com",
                Code: "004827"),
            CancellationToken.None);

        User user = await harness.DbContext.Users.SingleAsync();
        Assert.True(user.EmailConfirmed);
    }

    [Fact]
    public async Task ConfirmEmailAsync_rejects_malformed_code()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        await harness.RegisterDefaultAsync();

        ApiValidationException exception = await Assert.ThrowsAsync<ApiValidationException>(() =>
            harness.Service.ConfirmEmailAsync(
                new ConfirmEmailRequest(
                    Email: "player@example.com",
                    Code: "12A456"),
                CancellationToken.None));

        Assert.NotNull(exception.Errors);
        Assert.Contains(nameof(ConfirmEmailRequest.Code), exception.Errors.Keys);
    }

    [Fact]
    public async Task ConfirmEmailAsync_rejects_incorrect_code_and_tracks_failed_attempts()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        await harness.RegisterDefaultAsync();

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.ConfirmEmailAsync(
                new ConfirmEmailRequest(
                    Email: "player@example.com",
                    Code: "999999"),
                CancellationToken.None));

        User user = await harness.DbContext.Users.SingleAsync();

        Assert.Equal(StatusCodes.Status400BadRequest, exception.StatusCode);
        Assert.False(user.EmailConfirmed);
        Assert.Equal(1, user.EmailVerificationFailedAttempts);
        Assert.NotNull(user.EmailVerificationCodeHash);
    }

    [Fact]
    public async Task ConfirmEmailAsync_rejects_expired_code()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        await harness.RegisterDefaultAsync();
        string code = harness.LastEmailVerificationCode();
        harness.Advance(TimeSpan.FromMinutes(10).Add(TimeSpan.FromSeconds(1)));

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.ConfirmEmailAsync(
                new ConfirmEmailRequest(
                    Email: "player@example.com",
                    Code: code),
                CancellationToken.None));

        User user = await harness.DbContext.Users.SingleAsync();

        Assert.Equal(StatusCodes.Status400BadRequest, exception.StatusCode);
        Assert.False(user.EmailConfirmed);
        Assert.Null(user.EmailVerificationCodeHash);
        Assert.Null(user.EmailVerificationCodeExpiresAtUtc);
    }

    [Fact]
    public async Task ConfirmEmailAsync_invalidates_code_after_too_many_failed_attempts()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        await harness.RegisterDefaultAsync();
        string code = harness.LastEmailVerificationCode();

        for (int attempt = 0; attempt < harness.EmailVerificationOptions.MaximumFailedAttempts; attempt += 1)
        {
            await Assert.ThrowsAsync<ApiException>(() =>
                harness.Service.ConfirmEmailAsync(
                    new ConfirmEmailRequest(
                        Email: "player@example.com",
                        Code: "999999"),
                    CancellationToken.None));
        }

        User user = await harness.DbContext.Users.SingleAsync();
        Assert.Null(user.EmailVerificationCodeHash);
        Assert.Equal(0, user.EmailVerificationFailedAttempts);

        await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.ConfirmEmailAsync(
                new ConfirmEmailRequest(
                    Email: "player@example.com",
                    Code: code),
                CancellationToken.None));
    }

    [Fact]
    public async Task ConfirmEmailAsync_rejects_code_reuse_after_confirmation()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        await harness.RegisterDefaultAsync();
        string code = harness.LastEmailVerificationCode();

        await harness.Service.ConfirmEmailAsync(
            new ConfirmEmailRequest(
                Email: "player@example.com",
                Code: code),
            CancellationToken.None);

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.ConfirmEmailAsync(
                new ConfirmEmailRequest(
                    Email: "player@example.com",
                    Code: code),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status400BadRequest, exception.StatusCode);
    }

    [Fact]
    public async Task ResendVerificationCodeAsync_generates_replacement_code()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        harness.QueueVerificationCode("111111");
        await harness.RegisterDefaultAsync();
        User user = await harness.DbContext.Users.SingleAsync();
        string originalHash = user.EmailVerificationCodeHash!;
        user.EmailVerificationFailedAttempts = 2;
        await harness.DbContext.SaveChangesAsync();

        harness.QueueVerificationCode("222222");
        harness.Advance(TimeSpan.FromSeconds(60));

        AuthMessageResponse response = await harness.Service.ResendVerificationCodeAsync(
            new ResendVerificationCodeRequest("PLAYER@example.com"),
            CancellationToken.None);

        user = await harness.DbContext.Users.SingleAsync();

        Assert.Equal(
            "If an unconfirmed account exists for this email, a verification code has been sent.",
            response.Message);
        Assert.Equal(2, harness.EmailSender.EmailVerificationEmails.Count);
        Assert.Equal("222222", harness.LastEmailVerificationCode());
        Assert.NotEqual(originalHash, user.EmailVerificationCodeHash);
        Assert.Equal(
            harness.HashVerificationCode(user.NormalizedEmail, "222222"),
            user.EmailVerificationCodeHash);
        Assert.Equal(0, user.EmailVerificationFailedAttempts);
        Assert.Equal(harness.TimeProvider.GetUtcNow(), user.EmailVerificationCodeLastSentAtUtc);
    }

    [Fact]
    public async Task ResendVerificationCodeAsync_enforces_cooldown()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        harness.QueueVerificationCode("111111");
        await harness.RegisterDefaultAsync();
        User user = await harness.DbContext.Users.SingleAsync();
        string originalHash = user.EmailVerificationCodeHash!;

        harness.QueueVerificationCode("222222");

        AuthMessageResponse response = await harness.Service.ResendVerificationCodeAsync(
            new ResendVerificationCodeRequest("player@example.com"),
            CancellationToken.None);

        user = await harness.DbContext.Users.SingleAsync();

        Assert.Equal(
            "If an unconfirmed account exists for this email, a verification code has been sent.",
            response.Message);
        Assert.Single(harness.EmailSender.EmailVerificationEmails);
        Assert.Equal(originalHash, user.EmailVerificationCodeHash);
    }

    [Fact]
    public async Task ResendVerificationCodeAsync_returns_generic_response_for_missing_email()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();

        AuthMessageResponse response = await harness.Service.ResendVerificationCodeAsync(
            new ResendVerificationCodeRequest("missing@example.com"),
            CancellationToken.None);

        Assert.Equal(
            "If an unconfirmed account exists for this email, a verification code has been sent.",
            response.Message);
        Assert.Empty(harness.EmailSender.EmailVerificationEmails);
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
        await harness.RegisterDefaultAsync();
        User user = await harness.DbContext.Users.SingleAsync();

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

        Assert.Equal(user.Id, passwordResetToken.UserId);
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
        await harness.RegisterAndConfirmDefaultAsync();
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
    public async Task RefreshAsync_returns_new_access_and_refresh_tokens()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        AuthResponse login = await harness.LoginDefaultAsync();

        AuthResponse refresh = await harness.Service.RefreshAsync(
            new RefreshRequest(login.RefreshToken),
            CancellationToken.None);

        Assert.NotEqual(login.AccessToken, refresh.AccessToken);
        Assert.NotEqual(login.RefreshToken, refresh.RefreshToken);
        Assert.Equal(login.User.Id, refresh.User.Id);
        ClaimsPrincipal principal = harness.ValidateAccessToken(refresh.AccessToken);
        Assert.Equal(refresh.User.Id.ToString(), principal.FindFirstValue(ClaimTypes.NameIdentifier));
    }

    [Fact]
    public async Task RefreshAsync_rotates_the_refresh_token()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        AuthResponse login = await harness.LoginDefaultAsync();

        AuthResponse refresh = await harness.Service.RefreshAsync(
            new RefreshRequest(login.RefreshToken),
            CancellationToken.None);

        RefreshToken oldToken = await harness.FindRefreshTokenAsync(login.RefreshToken);
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
        AuthResponse login = await harness.LoginDefaultAsync();

        await harness.Service.RefreshAsync(
            new RefreshRequest(login.RefreshToken),
            CancellationToken.None);

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.RefreshAsync(
                new RefreshRequest(login.RefreshToken),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status401Unauthorized, exception.StatusCode);
    }

    [Fact]
    public async Task RefreshAsync_rejects_expired_refresh_token()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        AuthResponse login = await harness.LoginDefaultAsync();
        harness.Advance(TimeSpan.FromDays(harness.JwtOptions.RefreshTokenExpirationDays + 1));

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.RefreshAsync(
                new RefreshRequest(login.RefreshToken),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status401Unauthorized, exception.StatusCode);
    }

    [Fact]
    public async Task RefreshAsync_rejects_revoked_refresh_token()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        AuthResponse login = await harness.LoginDefaultAsync();
        RefreshToken refreshToken = await harness.FindRefreshTokenAsync(login.RefreshToken);
        refreshToken.RevokedAtUtc = harness.TimeProvider.GetUtcNow();
        refreshToken.RevokedReason = "Test revocation";
        await harness.DbContext.SaveChangesAsync();

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.RefreshAsync(
                new RefreshRequest(login.RefreshToken),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status401Unauthorized, exception.StatusCode);
    }

    [Fact]
    public async Task LogoutAsync_revokes_refresh_token()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        AuthResponse login = await harness.LoginDefaultAsync();

        await harness.Service.LogoutAsync(
            new LogoutRequest(login.RefreshToken),
            CancellationToken.None);

        RefreshToken refreshToken = await harness.FindRefreshTokenAsync(login.RefreshToken);
        Assert.NotNull(refreshToken.RevokedAtUtc);
        Assert.Equal("Logout", refreshToken.RevokedReason);

        ApiException exception = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Service.RefreshAsync(
                new RefreshRequest(login.RefreshToken),
                CancellationToken.None));
        Assert.Equal(StatusCodes.Status401Unauthorized, exception.StatusCode);
    }

    [Fact]
    public async Task GetCurrentUserAsync_returns_registered_user_and_profile()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        await harness.RegisterAndConfirmDefaultAsync();
        User user = await harness.DbContext.Users
            .Include(candidate => candidate.HeroProfile)
            .SingleAsync();

        ClaimsPrincipal principal = new(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, user.Id.ToString())],
            authenticationType: "Test"));

        MeResponse me = await harness.Service.GetCurrentUserAsync(
            principal,
            CancellationToken.None);

        Assert.Equal(user.Id, me.User.Id);
        Assert.Equal(user.HeroProfile!.Id, me.HeroProfile.Id);
        Assert.Equal("Morning Warden", me.HeroProfile.HeroName);
    }

    [Fact]
    public async Task GetCurrentUserAsync_returns_user_and_profile_from_valid_jwt()
    {
        using AuthServiceHarness harness = AuthServiceHarness.Create();
        AuthResponse login = await harness.LoginDefaultAsync();

        ClaimsPrincipal principal = harness.ValidateAccessToken(login.AccessToken);

        MeResponse me = await harness.Service.GetCurrentUserAsync(
            principal,
            CancellationToken.None);

        Assert.Equal(login.User.Id, me.User.Id);
        Assert.Equal("player@example.com", me.User.Email);
        Assert.Equal("Morning Warden", me.HeroProfile.HeroName);
    }

    private sealed class AuthServiceHarness : IDisposable
    {
        private AuthServiceHarness(
            LevelHabitDbContext dbContext,
            IAuthService service,
            IRefreshTokenService refreshTokenService,
            TestEmailVerificationCodeService emailVerificationCodeService,
            TestEmailSender emailSender,
            JwtOptions jwtOptions,
            EmailVerificationOptions emailVerificationOptions,
            MutableTimeProvider timeProvider)
        {
            DbContext = dbContext;
            Service = service;
            RefreshTokenService = refreshTokenService;
            EmailVerificationCodeService = emailVerificationCodeService;
            EmailSender = emailSender;
            JwtOptions = jwtOptions;
            EmailVerificationOptions = emailVerificationOptions;
            TimeProvider = timeProvider;
        }

        public LevelHabitDbContext DbContext { get; }

        public IAuthService Service { get; }

        public IRefreshTokenService RefreshTokenService { get; }

        public TestEmailVerificationCodeService EmailVerificationCodeService { get; }

        public TestEmailSender EmailSender { get; }

        public JwtOptions JwtOptions { get; }

        public EmailVerificationOptions EmailVerificationOptions { get; }

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
            EmailVerificationOptions emailVerificationOptions = new()
            {
                CodeExpirationMinutes = 10,
                ResendCooldownSeconds = 60,
                MaximumFailedAttempts = 5
            };
            MutableTimeProvider timeProvider = new(global::System.TimeProvider.System.GetUtcNow());

            JwtTokenService tokenService = new(
                Options.Create(jwtOptions),
                timeProvider);
            RefreshTokenService refreshTokenService = new(
                Options.Create(jwtOptions),
                timeProvider);
            TestEmailVerificationCodeService emailVerificationCodeService = new();
            TestEmailSender emailSender = new();

            AuthService service = new(
                dbContext,
                new PasswordHashService(),
                tokenService,
                refreshTokenService,
                emailVerificationCodeService,
                emailSender,
                Options.Create(new FrontendOptions
                {
                    BaseUrl = "https://levelhabit.example"
                }),
                Options.Create(emailVerificationOptions),
                timeProvider,
                NullLogger<AuthService>.Instance);

            return new AuthServiceHarness(
                dbContext,
                service,
                refreshTokenService,
                emailVerificationCodeService,
                emailSender,
                jwtOptions,
                emailVerificationOptions,
                timeProvider);
        }

        public Task<RegisterResponse> RegisterDefaultAsync()
        {
            return Service.RegisterAsync(
                new RegisterRequest(
                    Email: "player@example.com",
                    Password: "CorrectHorse123!",
                    DisplayName: "Player One",
                    HeroName: "Morning Warden"),
                CancellationToken.None);
        }

        public async Task RegisterAndConfirmDefaultAsync()
        {
            await RegisterDefaultAsync();
            await Service.ConfirmEmailAsync(
                new ConfirmEmailRequest(
                    Email: "player@example.com",
                    Code: LastEmailVerificationCode()),
                CancellationToken.None);
        }

        public async Task<AuthResponse> LoginDefaultAsync()
        {
            await RegisterAndConfirmDefaultAsync();

            return await Service.LoginAsync(
                new LoginRequest(
                    Email: "player@example.com",
                    Password: "CorrectHorse123!"),
                CancellationToken.None);
        }

        public void QueueVerificationCode(string code)
        {
            EmailVerificationCodeService.QueueCode(code);
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

        public string HashVerificationCode(string normalizedEmail, string code)
        {
            return EmailVerificationCodeService.HashCode(normalizedEmail, code);
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

        public string LastEmailVerificationCode()
        {
            return EmailSender.EmailVerificationEmails.Last().VerificationCode;
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

    private sealed class TestEmailVerificationCodeService : IEmailVerificationCodeService
    {
        private readonly Queue<string> queuedCodes = new();

        public void QueueCode(string code)
        {
            queuedCodes.Enqueue(code);
        }

        public string GenerateCode()
        {
            return queuedCodes.Count > 0 ? queuedCodes.Dequeue() : "123456";
        }

        public string HashCode(string normalizedEmail, string code)
        {
            byte[] codeBytes = Encoding.UTF8.GetBytes(
                $"{normalizedEmail}:{code}:test-pepper");
            byte[] hashBytes = SHA256.HashData(codeBytes);

            return Convert.ToHexString(hashBytes);
        }

        public bool VerifyCode(string normalizedEmail, string code, string codeHash)
        {
            if (codeHash.Length != 64)
            {
                return false;
            }

            byte[] storedHashBytes;

            try
            {
                storedHashBytes = Convert.FromHexString(codeHash);
            }
            catch (FormatException)
            {
                return false;
            }

            byte[] submittedHashBytes = Convert.FromHexString(
                HashCode(normalizedEmail, code));

            return CryptographicOperations.FixedTimeEquals(
                storedHashBytes,
                submittedHashBytes);
        }
    }

    private sealed class TestEmailSender : IEmailSender
    {
        public List<PasswordResetEmail> PasswordResetEmails { get; } = [];

        public List<EmailVerificationEmail> EmailVerificationEmails { get; } = [];

        public Task SendPasswordResetEmailAsync(
            string toEmail,
            string resetUrl,
            CancellationToken cancellationToken = default)
        {
            PasswordResetEmails.Add(new PasswordResetEmail(toEmail, resetUrl));

            return Task.CompletedTask;
        }

        public Task SendEmailVerificationCodeAsync(
            string toEmail,
            string verificationCode,
            TimeSpan expiresIn,
            CancellationToken cancellationToken = default)
        {
            EmailVerificationEmails.Add(
                new EmailVerificationEmail(toEmail, verificationCode, expiresIn));

            return Task.CompletedTask;
        }
    }

    private sealed record PasswordResetEmail(string ToEmail, string ResetUrl);

    private sealed record EmailVerificationEmail(
        string ToEmail,
        string VerificationCode,
        TimeSpan ExpiresIn);
}
