using System.ComponentModel.DataAnnotations;
using LevelHabit.Api.Domain;

namespace LevelHabit.Api.Contracts.Habits;

public sealed record UpdateHabitRequest(
    [Required]
    [StringLength(Habit.TitleMaxLength, MinimumLength = 1)]
    string Title,

    [MaxLength(Habit.DescriptionMaxLength)]
    string? Description,

    [Required]
    [MaxLength(Habit.CategoryMaxLength)]
    string Category,

    [Required]
    [MaxLength(Habit.DifficultyMaxLength)]
    string Difficulty,

    [Required]
    [MaxLength(Habit.FrequencyMaxLength)]
    string Frequency);
