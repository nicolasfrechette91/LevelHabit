using LevelHabit.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LevelHabit.Api.Data.Configurations;

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");

        builder.HasKey(user => user.Id);

        builder.Property(user => user.Id)
            .HasColumnName("id");

        builder.Property(user => user.Email)
            .HasColumnName("email")
            .HasMaxLength(User.EmailMaxLength)
            .IsRequired();

        builder.Property(user => user.NormalizedEmail)
            .HasColumnName("normalized_email")
            .HasMaxLength(User.EmailMaxLength)
            .IsRequired();

        builder.Property(user => user.DisplayName)
            .HasColumnName("display_name")
            .HasMaxLength(User.DisplayNameMaxLength)
            .IsRequired();

        builder.Property(user => user.PasswordHash)
            .HasColumnName("password_hash")
            .HasMaxLength(User.PasswordHashMaxLength)
            .IsRequired();

        builder.Property(user => user.EmailConfirmed)
            .HasColumnName("email_confirmed")
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(user => user.EmailConfirmedAtUtc)
            .HasColumnName("email_confirmed_at_utc");

        builder.Property(user => user.EmailVerificationCodeHash)
            .HasColumnName("email_verification_code_hash")
            .HasMaxLength(User.EmailVerificationCodeHashMaxLength);

        builder.Property(user => user.EmailVerificationCodeExpiresAtUtc)
            .HasColumnName("email_verification_code_expires_at_utc");

        builder.Property(user => user.EmailVerificationCodeLastSentAtUtc)
            .HasColumnName("email_verification_code_last_sent_at_utc");

        builder.Property(user => user.EmailVerificationFailedAttempts)
            .HasColumnName("email_verification_failed_attempts")
            .HasDefaultValue(0)
            .IsRequired();

        builder.Property(user => user.CreatedAtUtc)
            .HasColumnName("created_at_utc")
            .IsRequired();

        builder.Property(user => user.UpdatedAtUtc)
            .HasColumnName("updated_at_utc")
            .IsRequired();

        builder.HasIndex(user => user.NormalizedEmail)
            .IsUnique();
    }
}
