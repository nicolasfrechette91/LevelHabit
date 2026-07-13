using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using LevelHabit.Api.Auth;
using Microsoft.Extensions.Options;

namespace LevelHabit.Api.Services.Security;

public sealed class EmailVerificationCodeService : IEmailVerificationCodeService
{
    private readonly byte[] hashKey;

    public EmailVerificationCodeService(IOptions<JwtOptions> jwtOptions)
    {
        string secret = JwtSecretValidator.GetValidatedSecret(jwtOptions.Value.Secret);
        hashKey = Encoding.UTF8.GetBytes(secret);
    }

    public string GenerateCode()
    {
        return RandomNumberGenerator
            .GetInt32(0, 1_000_000)
            .ToString("D6", CultureInfo.InvariantCulture);
    }

    public string HashCode(string normalizedEmail, string code)
    {
        byte[] codeBytes = Encoding.UTF8.GetBytes($"{normalizedEmail}:{code}");
        byte[] hashBytes = HMACSHA256.HashData(hashKey, codeBytes);

        return Convert.ToHexString(hashBytes);
    }

    public bool VerifyCode(string normalizedEmail, string code, string codeHash)
    {
        if (codeHash.Length != 64)
        {
            return false;
        }

        byte[] storedHashBytes;

        try
        {
            storedHashBytes = Convert.FromHexString(codeHash);
        }
        catch (FormatException)
        {
            return false;
        }

        byte[] submittedHashBytes = Convert.FromHexString(HashCode(normalizedEmail, code));

        return CryptographicOperations.FixedTimeEquals(
            storedHashBytes,
            submittedHashBytes);
    }
}
