using System.Text;
using LevelHabit.Api.Auth;
using LevelHabit.Api.Data;
using LevelHabit.Api.Middleware;
using LevelHabit.Api.Observability;
using LevelHabit.Api.Services.Achievements;
using LevelHabit.Api.Services.Analytics;
using LevelHabit.Api.Services.Auth;
using LevelHabit.Api.Services.Email;
using LevelHabit.Api.Services.Quests;
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
builder.Services.Configure<EmailOptions>(
    builder.Configuration.GetSection(EmailOptions.SectionName));
builder.Services.Configure<BrevoOptions>(
    builder.Configuration.GetSection(BrevoOptions.SectionName));
builder.Services.Configure<FrontendOptions>(
    builder.Configuration.GetSection(FrontendOptions.SectionName));

string emailProvider = GetRequiredConfigurationValue(
    builder.Configuration,
    "Email:Provider");

ValidateRequiredConfigurationValue(builder.Configuration, "Frontend:BaseUrl");

if (string.Equals(emailProvider, "Development", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddScoped<IEmailSender, DevelopmentEmailSender>();
}
else if (string.Equals(emailProvider, "Brevo", StringComparison.OrdinalIgnoreCase))
{
    ValidateRequiredConfigurationValue(builder.Configuration, "Brevo:ApiKey");
    ValidateRequiredConfigurationValue(builder.Configuration, "Brevo:FromEmail");
    ValidateRequiredConfigurationValue(builder.Configuration, "Brevo:FromName");

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
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAchievementService, AchievementService>();
builder.Services.AddScoped<IAnalyticsService, AnalyticsService>();
builder.Services.AddScoped<IQuestService, QuestService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy(AngularLocalDevelopmentPolicy, policy =>
    {
        policy
            .WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
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

public partial class Program;
