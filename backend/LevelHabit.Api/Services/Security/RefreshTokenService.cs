using System.Security.Cryptography;
using System.Text;
using LevelHabit.Api.Auth;
using LevelHabit.Api.Domain;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace LevelHabit.Api.Services.Security;

public sealed class RefreshTokenService(
    IOptions<JwtOptions> jwtOptions,
    TimeProvider timeProvider) : IRefreshTokenService
{
    private const int TokenByteLength = 64;

    public CreatedRefreshToken CreateToken(User user)
    {
        DateTimeOffset now = timeProvider.GetUtcNow();
        string plaintextToken = Base64UrlEncoder.Encode(
            RandomNumberGenerator.GetBytes(TokenByteLength));

        RefreshToken refreshToken = new()
        {
            UserId = user.Id,
            TokenHash = HashToken(plaintextToken),
            CreatedAtUtc = now,
            ExpiresAtUtc = now.AddDays(jwtOptions.Value.RefreshTokenExpirationDays)
        };

        return new CreatedRefreshToken(plaintextToken, refreshToken);
    }

    public string HashToken(string refreshToken)
    {
        byte[] tokenBytes = Encoding.UTF8.GetBytes(refreshToken);
        byte[] hashBytes = SHA256.HashData(tokenBytes);

        return Convert.ToHexString(hashBytes);
    }
}
