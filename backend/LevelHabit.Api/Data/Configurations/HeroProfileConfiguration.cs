using LevelHabit.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LevelHabit.Api.Data.Configurations;

public sealed class HeroProfileConfiguration : IEntityTypeConfiguration<HeroProfile>
{
    public void Configure(EntityTypeBuilder<HeroProfile> builder)
    {
        builder.ToTable("hero_profiles");

        builder.HasKey(profile => profile.Id);

        builder.Property(profile => profile.Id)
            .HasColumnName("id");

        builder.Property(profile => profile.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(profile => profile.HeroName)
            .HasColumnName("hero_name")
            .HasMaxLength(HeroProfile.HeroNameMaxLength)
            .IsRequired();

        builder.Property(profile => profile.Level)
            .HasColumnName("level")
            .IsRequired();

        builder.Property(profile => profile.TotalXp)
            .HasColumnName("total_xp")
            .IsRequired();

        builder.Property(profile => profile.CurrentStreak)
            .HasColumnName("current_streak")
            .IsRequired();

        builder.Property(profile => profile.CreatedAtUtc)
            .HasColumnName("created_at_utc")
            .IsRequired();

        builder.Property(profile => profile.UpdatedAtUtc)
            .HasColumnName("updated_at_utc")
            .IsRequired();

        builder.HasOne(profile => profile.User)
            .WithOne(user => user.HeroProfile)
            .HasForeignKey<HeroProfile>(profile => profile.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(profile => profile.UserId)
            .IsUnique();
    }
}
