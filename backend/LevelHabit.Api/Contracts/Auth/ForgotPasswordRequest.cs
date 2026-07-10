using System.ComponentModel.DataAnnotations;
using LevelHabit.Api.Domain;

namespace LevelHabit.Api.Contracts.Auth;

public sealed record ForgotPasswordRequest(
    [Required]
    [EmailAddress]
    [MaxLength(User.EmailMaxLength)]
    string Email);
