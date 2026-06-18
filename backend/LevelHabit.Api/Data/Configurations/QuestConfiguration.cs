using LevelHabit.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LevelHabit.Api.Data.Configurations;

public sealed class QuestConfiguration : IEntityTypeConfiguration<Quest>
{
    public void Configure(EntityTypeBuilder<Quest> builder)
    {
        builder.ToTable("quests");

        builder.HasKey(quest => quest.Id);

        builder.Property(quest => quest.Id)
            .HasColumnName("id");

        builder.Property(quest => quest.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(quest => quest.Title)
            .HasColumnName("title")
            .HasMaxLength(Quest.TitleMaxLength)
            .IsRequired();

        builder.Property(quest => quest.Description)
            .HasColumnName("description")
            .HasMaxLength(Quest.DescriptionMaxLength)
            .IsRequired();

        builder.Property(quest => quest.Category)
            .HasColumnName("category")
            .HasMaxLength(Quest.CategoryMaxLength)
            .IsRequired();

        builder.Property(quest => quest.Difficulty)
            .HasColumnName("difficulty")
            .HasMaxLength(Quest.DifficultyMaxLength)
            .IsRequired();

        builder.Property(quest => quest.Frequency)
            .HasColumnName("frequency")
            .HasMaxLength(Quest.FrequencyMaxLength)
            .IsRequired();

        builder.Property(quest => quest.IsArchived)
            .HasColumnName("is_archived")
            .IsRequired();

        builder.Property(quest => quest.CreatedAtUtc)
            .HasColumnName("created_at_utc")
            .IsRequired();

        builder.Property(quest => quest.UpdatedAtUtc)
            .HasColumnName("updated_at_utc")
            .IsRequired();

        builder.HasOne(quest => quest.User)
            .WithMany(user => user.Quests)
            .HasForeignKey(quest => quest.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(quest => new { quest.UserId, quest.IsArchived });
    }
}
