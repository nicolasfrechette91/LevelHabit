using LevelHabit.Api.Data.Configurations;
using LevelHabit.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace LevelHabit.Api.Data;

public sealed class LevelHabitDbContext(DbContextOptions<LevelHabitDbContext> options)
    : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<ProgressProfile> ProgressProfiles => Set<ProgressProfile>();

    public DbSet<Habit> Habits => Set<Habit>();

    public DbSet<HabitCompletion> HabitCompletions => Set<HabitCompletion>();

    public DbSet<Achievement> Achievements => Set<Achievement>();

    public DbSet<UserAchievement> UserAchievements => Set<UserAchievement>();

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public DbSet<AuthToken> AuthTokens => Set<AuthToken>();

    public DbSet<HabitReminder> HabitReminders => Set<HabitReminder>();

    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfiguration(new UserConfiguration());
        modelBuilder.ApplyConfiguration(new ProgressProfileConfiguration());
        modelBuilder.ApplyConfiguration(new HabitConfiguration());
        modelBuilder.ApplyConfiguration(new HabitCompletionConfiguration());
        modelBuilder.ApplyConfiguration(new AchievementConfiguration());
        modelBuilder.ApplyConfiguration(new UserAchievementConfiguration());
        modelBuilder.ApplyConfiguration(new RefreshTokenConfiguration());
        modelBuilder.ApplyConfiguration(new AuthTokenConfiguration());
        modelBuilder.ApplyConfiguration(new HabitReminderConfiguration());
        modelBuilder.ApplyConfiguration(new NotificationConfiguration());
    }
}
