using System.ComponentModel.DataAnnotations;
using LevelHabit.Api.Domain;

namespace LevelHabit.Api.Contracts.Auth;

public sealed record ResetPasswordRequest(
    [Required]
    [EmailAddress]
    [MaxLength(User.EmailMaxLength)]
    string Email,

    [Required]
    string Token,

    [Required]
    [MinLength(8)]
    [MaxLength(128)]
    string NewPassword);
