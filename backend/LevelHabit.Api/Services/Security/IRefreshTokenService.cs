using LevelHabit.Api.Domain;

namespace LevelHabit.Api.Services.Security;

public interface IRefreshTokenService
{
    CreatedRefreshToken CreateToken(User user);

    string HashToken(string refreshToken);
}
