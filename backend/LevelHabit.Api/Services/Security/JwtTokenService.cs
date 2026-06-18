using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using LevelHabit.Api.Auth;
using LevelHabit.Api.Domain;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace LevelHabit.Api.Services.Security;

public sealed class JwtTokenService(
    IOptions<JwtOptions> jwtOptions,
    TimeProvider timeProvider) : IJwtTokenService
{
    public JwtToken CreateToken(User user)
    {
        JwtOptions options = jwtOptions.Value;
        string secret = JwtSecretValidator.GetValidatedSecret(options.Secret);
        DateTimeOffset now = timeProvider.GetUtcNow();
        DateTimeOffset expiresAtUtc = now.AddMinutes(options.ExpirationMinutes);

        Claim[] claims =
        [
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Name, user.DisplayName)
        ];

        SymmetricSecurityKey key = new(Encoding.UTF8.GetBytes(secret));
        SigningCredentials credentials = new(key, SecurityAlgorithms.HmacSha256);

        JwtSecurityToken token = new(
            issuer: options.Issuer,
            audience: options.Audience,
            claims: claims,
            notBefore: now.UtcDateTime,
            expires: expiresAtUtc.UtcDateTime,
            signingCredentials: credentials);

        return new JwtToken(
            AccessToken: new JwtSecurityTokenHandler().WriteToken(token),
            ExpiresAtUtc: expiresAtUtc);
    }
}
