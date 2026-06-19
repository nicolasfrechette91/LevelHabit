using LevelHabit.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LevelHabit.Api.Data.Configurations;

public sealed class QuestCompletionConfiguration : IEntityTypeConfiguration<QuestCompletion>
{
    public void Configure(EntityTypeBuilder<QuestCompletion> builder)
    {
        builder.ToTable("quest_completions");

        builder.HasKey(completion => completion.Id);

        builder.Property(completion => completion.Id)
            .HasColumnName("id");

        builder.Property(completion => completion.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(completion => completion.QuestId)
            .HasColumnName("quest_id")
            .IsRequired();

        builder.Property(completion => completion.CompletionDateUtc)
            .HasColumnName("completion_date_utc")
            .IsRequired();

        builder.Property(completion => completion.CompletedAtUtc)
            .HasColumnName("completed_at_utc")
            .IsRequired();

        builder.Property(completion => completion.XpAwarded)
            .HasColumnName("xp_awarded")
            .IsRequired();

        builder.HasOne(completion => completion.User)
            .WithMany(user => user.QuestCompletions)
            .HasForeignKey(completion => completion.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(completion => completion.Quest)
            .WithMany(quest => quest.Completions)
            .HasForeignKey(completion => completion.QuestId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(completion => new
            {
                completion.UserId,
                completion.QuestId,
                completion.CompletionDateUtc
            })
            .IsUnique();
    }
}
