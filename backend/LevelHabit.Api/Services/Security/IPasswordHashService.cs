using LevelHabit.Api.Domain;

namespace LevelHabit.Api.Services.Security;

public interface IPasswordHashService
{
    string HashPassword(User user, string password);

    PasswordVerificationOutcome VerifyPassword(User user, string passwordHash, string password);
}
