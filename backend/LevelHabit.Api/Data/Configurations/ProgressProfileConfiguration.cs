using LevelHabit.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LevelHabit.Api.Data.Configurations;

public sealed class ProgressProfileConfiguration : IEntityTypeConfiguration<ProgressProfile>
{
    public void Configure(EntityTypeBuilder<ProgressProfile> builder)
    {
        builder.ToTable("progress_profiles");

        builder.HasKey(profile => profile.Id);

        builder.Property(profile => profile.Id)
            .HasColumnName("id");

        builder.Property(profile => profile.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(profile => profile.DisplayName)
            .HasColumnName("display_name")
            .HasMaxLength(ProgressProfile.DisplayNameMaxLength)
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
            .WithOne(user => user.ProgressProfile)
            .HasForeignKey<ProgressProfile>(profile => profile.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(profile => profile.UserId)
            .IsUnique();
    }
}
