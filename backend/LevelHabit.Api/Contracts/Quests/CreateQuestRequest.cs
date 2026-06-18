using System.ComponentModel.DataAnnotations;
using LevelHabit.Api.Domain;

namespace LevelHabit.Api.Contracts.Quests;

public sealed record CreateQuestRequest(
    [Required]
    [StringLength(Quest.TitleMaxLength, MinimumLength = 1)]
    string Title,

    [MaxLength(Quest.DescriptionMaxLength)]
    string? Description,

    [Required]
    [MaxLength(Quest.CategoryMaxLength)]
    string Category,

    [Required]
    [MaxLength(Quest.DifficultyMaxLength)]
    string Difficulty,

    [Required]
    [MaxLength(Quest.FrequencyMaxLength)]
    string Frequency);
