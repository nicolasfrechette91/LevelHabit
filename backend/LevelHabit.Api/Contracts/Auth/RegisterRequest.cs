using System.ComponentModel.DataAnnotations;
using LevelHabit.Api.Domain;

namespace LevelHabit.Api.Contracts.Auth;

public sealed record RegisterRequest(
    [Required]
    [EmailAddress]
    [MaxLength(User.EmailMaxLength)]
    string Email,

    [Required]
    [MinLength(8)]
    [MaxLength(128)]
    string Password,

    [Required]
    [StringLength(User.DisplayNameMaxLength, MinimumLength = 2)]
    string DisplayName,

    [Required]
    [StringLength(ProgressProfile.DisplayNameMaxLength, MinimumLength = 2)]
    string ProgressDisplayName);
