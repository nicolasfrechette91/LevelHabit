using LevelHabit.Api.Data.Configurations;
using LevelHabit.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace LevelHabit.Api.Data;

public sealed class LevelHabitDbContext(DbContextOptions<LevelHabitDbContext> options)
    : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<HeroProfile> HeroProfiles => Set<HeroProfile>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfiguration(new UserConfiguration());
        modelBuilder.ApplyConfiguration(new HeroProfileConfiguration());
    }
}
