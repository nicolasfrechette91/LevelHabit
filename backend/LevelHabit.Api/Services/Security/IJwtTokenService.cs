using LevelHabit.Api.Domain;

namespace LevelHabit.Api.Services.Security;

public interface IJwtTokenService
{
    JwtToken CreateToken(User user);
}
