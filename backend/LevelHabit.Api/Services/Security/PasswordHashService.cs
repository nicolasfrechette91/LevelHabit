using LevelHabit.Api.Domain;
using Microsoft.AspNetCore.Identity;

namespace LevelHabit.Api.Services.Security;

public sealed class PasswordHashService : IPasswordHashService
{
    private readonly PasswordHasher<User> passwordHasher = new();

    public string HashPassword(User user, string password)
    {
        return passwordHasher.HashPassword(user, password);
    }

    public PasswordVerificationOutcome VerifyPassword(User user, string passwordHash, string password)
    {
        PasswordVerificationResult result = passwordHasher.VerifyHashedPassword(
            user,
            passwordHash,
            password);

        return result switch
        {
            PasswordVerificationResult.Success => PasswordVerificationOutcome.Success,
            PasswordVerificationResult.SuccessRehashNeeded => PasswordVerificationOutcome.SuccessRehashNeeded,
            _ => PasswordVerificationOutcome.Failed
        };
    }
}
