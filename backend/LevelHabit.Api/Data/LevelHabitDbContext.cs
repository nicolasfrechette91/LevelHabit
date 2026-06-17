using Microsoft.EntityFrameworkCore;

namespace LevelHabit.Api.Data;

public sealed class LevelHabitDbContext(DbContextOptions<LevelHabitDbContext> options)
    : DbContext(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
    }
}
