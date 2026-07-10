using LevelHabit.Api.Data.Configurations;
using LevelHabit.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace LevelHabit.Api.Data;

public sealed class LevelHabitDbContext(DbContextOptions<LevelHabitDbContext> options)
    : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<HeroProfile> HeroProfiles => Set<HeroProfile>();

    public DbSet<Quest> Quests => Set<Quest>();

    public DbSet<QuestCompletion> QuestCompletions => Set<QuestCompletion>();

    public DbSet<Achievement> Achievements => Set<Achievement>();

    public DbSet<UserAchievement> UserAchievements => Set<UserAchievement>();

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public DbSet<AuthToken> AuthTokens => Set<AuthToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfiguration(new UserConfiguration());
        modelBuilder.ApplyConfiguration(new HeroProfileConfiguration());
        modelBuilder.ApplyConfiguration(new QuestConfiguration());
        modelBuilder.ApplyConfiguration(new QuestCompletionConfiguration());
        modelBuilder.ApplyConfiguration(new AchievementConfiguration());
        modelBuilder.ApplyConfiguration(new UserAchievementConfiguration());
        modelBuilder.ApplyConfiguration(new RefreshTokenConfiguration());
        modelBuilder.ApplyConfiguration(new AuthTokenConfiguration());
    }
}
