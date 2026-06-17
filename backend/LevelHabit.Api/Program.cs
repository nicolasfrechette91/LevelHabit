using LevelHabit.Api.Data;
using Microsoft.EntityFrameworkCore;

const string AngularLocalDevelopmentPolicy = "AngularLocalDevelopment";

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' is not configured.");

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>()
    ?? ["http://localhost:4200"];

builder.Services.AddControllers();

builder.Services.AddDbContext<LevelHabitDbContext>(options =>
{
    options.UseNpgsql(connectionString);
});

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

app.UseHttpsRedirection();
app.UseCors(AngularLocalDevelopmentPolicy);

app.MapControllers();

app.Run();
