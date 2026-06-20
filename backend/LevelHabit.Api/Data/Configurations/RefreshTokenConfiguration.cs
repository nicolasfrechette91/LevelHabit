using LevelHabit.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LevelHabit.Api.Data.Configurations;

public sealed class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.ToTable("refresh_tokens");

        builder.HasKey(refreshToken => refreshToken.Id);

        builder.Property(refreshToken => refreshToken.Id)
            .HasColumnName("id");

        builder.Property(refreshToken => refreshToken.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(refreshToken => refreshToken.TokenHash)
            .HasColumnName("token_hash")
            .HasMaxLength(RefreshToken.TokenHashMaxLength)
            .IsRequired();

        builder.Property(refreshToken => refreshToken.CreatedAtUtc)
            .HasColumnName("created_at_utc")
            .IsRequired();

        builder.Property(refreshToken => refreshToken.ExpiresAtUtc)
            .HasColumnName("expires_at_utc")
            .IsRequired();

        builder.Property(refreshToken => refreshToken.RevokedAtUtc)
            .HasColumnName("revoked_at_utc");

        builder.Property(refreshToken => refreshToken.ReplacedByTokenHash)
            .HasColumnName("replaced_by_token_hash")
            .HasMaxLength(RefreshToken.TokenHashMaxLength);

        builder.Property(refreshToken => refreshToken.RevokedReason)
            .HasColumnName("revoked_reason")
            .HasMaxLength(RefreshToken.RevokedReasonMaxLength);

        builder.HasIndex(refreshToken => refreshToken.TokenHash)
            .IsUnique();

        builder.HasIndex(refreshToken => new
        {
            refreshToken.UserId,
            refreshToken.ExpiresAtUtc
        });

        builder.HasOne(refreshToken => refreshToken.User)
            .WithMany(user => user.RefreshTokens)
            .HasForeignKey(refreshToken => refreshToken.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
