using System.Text;
using LevelHabit.Api.Auth;
using LevelHabit.Api.Data;
using LevelHabit.Api.Middleware;
using LevelHabit.Api.Observability;
using LevelHabit.Api.Services.Achievements;
using LevelHabit.Api.Services.Analytics;
using LevelHabit.Api.Services.Auth;
using LevelHabit.Api.Services.Email;
using LevelHabit.Api.Services.Notifications;
using LevelHabit.Api.Services.Habits;
using LevelHabit.Api.Services.Reminders;
using LevelHabit.Api.Services.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

const string AngularLocalDevelopmentPolicy = "AngularLocalDevelopment";

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseSentry(SentryErrorTracking.Configure);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' is not configured.");

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>()
    ?? ["http://localhost:4200"];

if (allowedOrigins.Length == 0 || allowedOrigins.Any(origin => origin.Contains('*')))
{
    throw new InvalidOperationException(
        "Cors:AllowedOrigins must contain explicit origins and cannot use wildcards.");
}

AuthCookieOptions resolvedAuthCookieOptions = builder.Configuration
    .GetSection(AuthCookieOptions.SectionName)
    .Get<AuthCookieOptions>() ?? new AuthCookieOptions();

if (
    string.IsNullOrWhiteSpace(resolvedAuthCookieOptions.Path)
    || !resolvedAuthCookieOptions.Path.StartsWith("/", StringComparison.Ordinal))
{
    throw new InvalidOperationException(
        "AuthCookies:Path must be an absolute cookie path beginning with '/'.");
}

if (
    resolvedAuthCookieOptions.Domain is { Length: > 0 } cookieDomain
    && (cookieDomain.Contains("://", StringComparison.Ordinal)
        || cookieDomain.Contains('/')))
{
    throw new InvalidOperationException(
        "AuthCookies:Domain must be a hostname without a scheme or path.");
}

if (
    !builder.Environment.IsDevelopment()
    && (!resolvedAuthCookieOptions.Secure
        || resolvedAuthCookieOptions.SameSite != SameSiteMode.None))
{
    throw new InvalidOperationException(
        "Production authentication cookies must use Secure=true and SameSite=None.");
}

builder.Services.AddControllers();
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        ValidationProblemDetails problemDetails = new(context.ModelState)
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "Validation failed",
            Detail = "One or more validation errors occurred."
        };

        return new BadRequestObjectResult(problemDetails);
    };
});

builder.Services.AddDbContext<LevelHabitDbContext>(options =>
{
    options.UseNpgsql(connectionString);
});

builder.Services.Configure<JwtOptions>(
    builder.Configuration.GetSection(JwtOptions.SectionName));
builder.Services.Configure<AuthCookieOptions>(
    builder.Configuration.GetSection(AuthCookieOptions.SectionName));
builder.Services.Configure<EmailOptions>(
    builder.Configuration.GetSection(EmailOptions.SectionName));
builder.Services.Configure<FrontendOptions>(
    builder.Configuration.GetSection(FrontendOptions.SectionName));
builder.Services.Configure<EmailVerificationOptions>(
    builder.Configuration.GetSection(EmailVerificationOptions.SectionName));

BrevoOptions brevoOptions = ResolveBrevoOptions(builder.Configuration);
builder.Services.Configure<BrevoOptions>(options =>
{
    options.ApiKey = brevoOptions.ApiKey;
    options.SenderEmail = brevoOptions.SenderEmail;
    options.SenderName = brevoOptions.SenderName;
    options.FromEmail = brevoOptions.FromEmail;
    options.FromName = brevoOptions.FromName;
});

string emailProvider = ResolveEmailProvider(
    builder.Configuration,
    builder.Environment,
    brevoOptions);

ValidateRequiredConfigurationValue(builder.Configuration, "Frontend:BaseUrl");

if (string.Equals(emailProvider, "Development", StringComparison.OrdinalIgnoreCase))
{
    if (!builder.Environment.IsDevelopment())
    {
        throw new InvalidOperationException(
            "The Development email provider can only be used in Development.");
    }

    builder.Services.AddScoped<IEmailSender, DevelopmentEmailSender>();
}
else if (string.Equals(emailProvider, "Brevo", StringComparison.OrdinalIgnoreCase))
{
    ValidateBrevoOptions(brevoOptions);

    builder.Services.AddHttpClient<IEmailSender, BrevoEmailSender>(httpClient =>
    {
        httpClient.BaseAddress = BrevoEmailSender.ApiBaseUri;
    });
}
else
{
    throw new InvalidOperationException(
        "Email provider must be configured as either 'Development' or 'Brevo'.");
}

JwtOptions jwtOptions = builder.Configuration
    .GetSection(JwtOptions.SectionName)
    .Get<JwtOptions>() ?? new JwtOptions();

string jwtSecret = JwtSecretValidator.GetValidatedSecret(jwtOptions.Secret);
SymmetricSecurityKey signingKey = new(Encoding.UTF8.GetBytes(jwtSecret));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = signingKey,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<IPasswordHashService, PasswordHashService>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IRefreshTokenService, RefreshTokenService>();
builder.Services.AddScoped<IAuthCookieService, AuthCookieService>();
builder.Services.AddScoped<IEmailVerificationCodeService, EmailVerificationCodeService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAchievementService, AchievementService>();
builder.Services.AddScoped<IAnalyticsService, AnalyticsService>();
builder.Services.AddScoped<IHabitService, HabitService>();
builder.Services.AddSingleton<IReminderScheduleCalculator, ReminderScheduleCalculator>();
builder.Services.AddScoped<IHabitReminderService, HabitReminderService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IHabitReminderProcessor, HabitReminderProcessor>();
builder.Services.AddHostedService<HabitReminderBackgroundService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy(AngularLocalDevelopmentPolicy, policy =>
    {
        policy
            .WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseHttpsRedirection();
app.UseCors(AngularLocalDevelopmentPolicy);
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

static string GetRequiredConfigurationValue(IConfiguration configuration, string key)
{
    string? value = configuration[key];

    if (string.IsNullOrWhiteSpace(value))
    {
        throw new InvalidOperationException($"Configuration value '{key}' is required.");
    }

    return value;
}

static void ValidateRequiredConfigurationValue(IConfiguration configuration, string key)
{
    _ = GetRequiredConfigurationValue(configuration, key);
}

static string ResolveEmailProvider(
    IConfiguration configuration,
    IHostEnvironment environment,
    BrevoOptions brevoOptions)
{
    string? configuredProvider = configuration["Email:Provider"];

    if (!string.IsNullOrWhiteSpace(configuredProvider))
    {
        return configuredProvider;
    }

    if (environment.IsDevelopment() && !BrevoOptionsAreConfigured(brevoOptions))
    {
        return "Development";
    }

    return "Brevo";
}

static BrevoOptions ResolveBrevoOptions(IConfiguration configuration)
{
    BrevoOptions options = configuration
        .GetSection(BrevoOptions.SectionName)
        .Get<BrevoOptions>() ?? new BrevoOptions();

    options.ApiKey = FirstNonBlank(configuration["BREVO_API_KEY"], options.ApiKey);
    options.SenderEmail = FirstNonBlank(
        configuration["BREVO_SENDER_EMAIL"],
        options.SenderEmail,
        options.FromEmail);
    options.SenderName = FirstNonBlank(
        configuration["BREVO_SENDER_NAME"],
        options.SenderName,
        options.FromName);

    return options;
}

static void ValidateBrevoOptions(BrevoOptions brevoOptions)
{
    ValidateResolvedConfigurationValue(
        brevoOptions.ApiKey,
        "BREVO_API_KEY or Brevo:ApiKey");
    ValidateResolvedConfigurationValue(
        brevoOptions.SenderEmail,
        "BREVO_SENDER_EMAIL or Brevo:SenderEmail");
    ValidateResolvedConfigurationValue(
        brevoOptions.SenderName,
        "BREVO_SENDER_NAME or Brevo:SenderName");
}

static void ValidateResolvedConfigurationValue(string? value, string key)
{
    if (string.IsNullOrWhiteSpace(value))
    {
        throw new InvalidOperationException($"Configuration value '{key}' is required.");
    }
}

static bool BrevoOptionsAreConfigured(BrevoOptions brevoOptions)
{
    return !string.IsNullOrWhiteSpace(brevoOptions.ApiKey)
        && !string.IsNullOrWhiteSpace(brevoOptions.SenderEmail)
        && !string.IsNullOrWhiteSpace(brevoOptions.SenderName);
}

static string? FirstNonBlank(params string?[] values)
{
    foreach (string? value in values)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            return value;
        }
    }

    return null;
}

public partial class Program;
