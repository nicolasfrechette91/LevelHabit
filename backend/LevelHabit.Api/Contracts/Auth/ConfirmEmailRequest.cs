using System.ComponentModel.DataAnnotations;
using LevelHabit.Api.Domain;

namespace LevelHabit.Api.Contracts.Auth;

public sealed record ConfirmEmailRequest(
    [Required]
    [EmailAddress]
    [MaxLength(User.EmailMaxLength)]
    string Email,

    [Required]
    [StringLength(6, MinimumLength = 6)]
    [RegularExpression("^[0-9]{6}$")]
    string Code);
