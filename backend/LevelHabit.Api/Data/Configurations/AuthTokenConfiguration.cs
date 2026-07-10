using LevelHabit.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LevelHabit.Api.Data.Configurations;

public sealed class AuthTokenConfiguration : IEntityTypeConfiguration<AuthToken>
{
    public void Configure(EntityTypeBuilder<AuthToken> builder)
    {
        builder.ToTable("auth_tokens");

        builder.HasKey(authToken => authToken.Id);

        builder.Property(authToken => authToken.Id)
            .HasColumnName("id");

        builder.Property(authToken => authToken.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(authToken => authToken.Purpose)
            .HasColumnName("purpose")
            .HasMaxLength(AuthToken.PurposeMaxLength)
            .IsRequired();

        builder.Property(authToken => authToken.TokenHash)
            .HasColumnName("token_hash")
            .HasMaxLength(AuthToken.TokenHashMaxLength)
            .IsRequired();

        builder.Property(authToken => authToken.CreatedAtUtc)
            .HasColumnName("created_at_utc")
            .IsRequired();

        builder.Property(authToken => authToken.ExpiresAtUtc)
            .HasColumnName("expires_at_utc")
            .IsRequired();

        builder.Property(authToken => authToken.UsedAtUtc)
            .HasColumnName("used_at_utc");

        builder.HasIndex(authToken => authToken.UserId);

        builder.HasIndex(authToken => authToken.Purpose);

        builder.HasIndex(authToken => authToken.TokenHash)
            .IsUnique();

        builder.HasOne(authToken => authToken.User)
            .WithMany(user => user.AuthTokens)
            .HasForeignKey(authToken => authToken.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
