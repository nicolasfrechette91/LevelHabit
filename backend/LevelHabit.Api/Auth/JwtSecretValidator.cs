namespace LevelHabit.Api.Auth;

public static class JwtSecretValidator
{
    public const int MinimumSecretLength = 32;

    public static string GetValidatedSecret(string? secret)
    {
        if (string.IsNullOrWhiteSpace(secret))
        {
            throw new InvalidOperationException(
                "JWT secret is not configured. Set Jwt:Secret in configuration or Jwt__Secret as an environment variable.");
        }

        if (secret.Length < MinimumSecretLength)
        {
            throw new InvalidOperationException(
                $"JWT secret must be at least {MinimumSecretLength} characters long.");
        }

        return secret;
    }
}
