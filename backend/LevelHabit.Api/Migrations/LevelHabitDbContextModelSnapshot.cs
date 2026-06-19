using System;
using LevelHabit.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace LevelHabit.Api.Migrations;

[DbContext(typeof(LevelHabitDbContext))]
public partial class LevelHabitDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
        modelBuilder
            .HasAnnotation("ProductVersion", "10.0.9")
            .HasAnnotation("Relational:MaxIdentifierLength", 63);

        modelBuilder.Entity("LevelHabit.Api.Domain.HeroProfile", builder =>
        {
            builder.Property<Guid>("Id")
                .HasColumnType("uuid")
                .HasColumnName("id");

            builder.Property<DateTimeOffset>("CreatedAtUtc")
                .HasColumnType("timestamp with time zone")
                .HasColumnName("created_at_utc");

            builder.Property<int>("CurrentStreak")
                .HasColumnType("integer")
                .HasColumnName("current_streak");

            builder.Property<string>("HeroName")
                .IsRequired()
                .HasMaxLength(80)
                .HasColumnType("character varying(80)")
                .HasColumnName("hero_name");

            builder.Property<int>("Level")
                .HasColumnType("integer")
                .HasColumnName("level");

            builder.Property<int>("TotalXp")
                .HasColumnType("integer")
                .HasColumnName("total_xp");

            builder.Property<DateTimeOffset>("UpdatedAtUtc")
                .HasColumnType("timestamp with time zone")
                .HasColumnName("updated_at_utc");

            builder.Property<Guid>("UserId")
                .HasColumnType("uuid")
                .HasColumnName("user_id");

            builder.Property<int>("XpAwarded")
                .HasColumnType("integer")
                .HasColumnName("xp_awarded");

            builder.HasKey("Id");

            builder.HasIndex("UserId")
                .IsUnique();

            builder.ToTable("hero_profiles", (string)null);
        });

        modelBuilder.Entity("LevelHabit.Api.Domain.QuestCompletion", builder =>
        {
            builder.Property<Guid>("Id")
                .HasColumnType("uuid")
                .HasColumnName("id");

            builder.Property<DateTimeOffset>("CompletedAtUtc")
                .HasColumnType("timestamp with time zone")
                .HasColumnName("completed_at_utc");

            builder.Property<DateOnly>("CompletionDateUtc")
                .HasColumnType("date")
                .HasColumnName("completion_date_utc");

            builder.Property<Guid>("QuestId")
                .HasColumnType("uuid")
                .HasColumnName("quest_id");

            builder.Property<Guid>("UserId")
                .HasColumnType("uuid")
                .HasColumnName("user_id");

            builder.HasKey("Id");

            builder.HasIndex("QuestId");

            builder.HasIndex("UserId", "QuestId", "CompletionDateUtc")
                .IsUnique();

            builder.ToTable("quest_completions", (string)null);
        });

        modelBuilder.Entity("LevelHabit.Api.Domain.Quest", builder =>
        {
            builder.Property<Guid>("Id")
                .HasColumnType("uuid")
                .HasColumnName("id");

            builder.Property<string>("Category")
                .IsRequired()
                .HasMaxLength(40)
                .HasColumnType("character varying(40)")
                .HasColumnName("category");

            builder.Property<DateTimeOffset>("CreatedAtUtc")
                .HasColumnType("timestamp with time zone")
                .HasColumnName("created_at_utc");

            builder.Property<string>("Description")
                .IsRequired()
                .HasMaxLength(1000)
                .HasColumnType("character varying(1000)")
                .HasColumnName("description");

            builder.Property<string>("Difficulty")
                .IsRequired()
                .HasMaxLength(20)
                .HasColumnType("character varying(20)")
                .HasColumnName("difficulty");

            builder.Property<string>("Frequency")
                .IsRequired()
                .HasMaxLength(20)
                .HasColumnType("character varying(20)")
                .HasColumnName("frequency");

            builder.Property<bool>("IsArchived")
                .HasColumnType("boolean")
                .HasColumnName("is_archived");

            builder.Property<string>("Title")
                .IsRequired()
                .HasMaxLength(140)
                .HasColumnType("character varying(140)")
                .HasColumnName("title");

            builder.Property<DateTimeOffset>("UpdatedAtUtc")
                .HasColumnType("timestamp with time zone")
                .HasColumnName("updated_at_utc");

            builder.Property<Guid>("UserId")
                .HasColumnType("uuid")
                .HasColumnName("user_id");

            builder.HasKey("Id");

            builder.HasIndex("UserId", "IsArchived");

            builder.ToTable("quests", (string)null);
        });

        modelBuilder.Entity("LevelHabit.Api.Domain.User", builder =>
        {
            builder.Property<Guid>("Id")
                .HasColumnType("uuid")
                .HasColumnName("id");

            builder.Property<DateTimeOffset>("CreatedAtUtc")
                .HasColumnType("timestamp with time zone")
                .HasColumnName("created_at_utc");

            builder.Property<string>("DisplayName")
                .IsRequired()
                .HasMaxLength(80)
                .HasColumnType("character varying(80)")
                .HasColumnName("display_name");

            builder.Property<string>("Email")
                .IsRequired()
                .HasMaxLength(320)
                .HasColumnType("character varying(320)")
                .HasColumnName("email");

            builder.Property<string>("NormalizedEmail")
                .IsRequired()
                .HasMaxLength(320)
                .HasColumnType("character varying(320)")
                .HasColumnName("normalized_email");

            builder.Property<string>("PasswordHash")
                .IsRequired()
                .HasMaxLength(512)
                .HasColumnType("character varying(512)")
                .HasColumnName("password_hash");

            builder.Property<DateTimeOffset>("UpdatedAtUtc")
                .HasColumnType("timestamp with time zone")
                .HasColumnName("updated_at_utc");

            builder.HasKey("Id");

            builder.HasIndex("NormalizedEmail")
                .IsUnique();

            builder.ToTable("users", (string)null);
        });

        modelBuilder.Entity("LevelHabit.Api.Domain.HeroProfile", builder =>
        {
            builder.HasOne("LevelHabit.Api.Domain.User", "User")
                .WithOne("HeroProfile")
                .HasForeignKey("LevelHabit.Api.Domain.HeroProfile", "UserId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            builder.Navigation("User");
        });

        modelBuilder.Entity("LevelHabit.Api.Domain.QuestCompletion", builder =>
        {
            builder.HasOne("LevelHabit.Api.Domain.Quest", "Quest")
                .WithMany("Completions")
                .HasForeignKey("QuestId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            builder.HasOne("LevelHabit.Api.Domain.User", "User")
                .WithMany("QuestCompletions")
                .HasForeignKey("UserId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            builder.Navigation("Quest");

            builder.Navigation("User");
        });

        modelBuilder.Entity("LevelHabit.Api.Domain.Quest", builder =>
        {
            builder.HasOne("LevelHabit.Api.Domain.User", "User")
                .WithMany("Quests")
                .HasForeignKey("UserId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            builder.Navigation("Completions");

            builder.Navigation("User");
        });

        modelBuilder.Entity("LevelHabit.Api.Domain.User", builder =>
        {
            builder.Navigation("HeroProfile");

            builder.Navigation("QuestCompletions");

            builder.Navigation("Quests");
        });
    }
}
