namespace LevelHabit.Api.Services.Email;

public sealed class DevelopmentEmailSender(
    ILogger<DevelopmentEmailSender> logger) : IEmailSender
{
    public Task SendPasswordResetEmailAsync(
        string toEmail,
        string resetUrl,
        CancellationToken cancellationToken = default)
    {
        logger.LogInformation(
            "Development password reset email for {ToEmail}. Reset link: {ResetUrl}",
            toEmail,
            resetUrl);

        return Task.CompletedTask;
    }

    public Task SendEmailVerificationCodeAsync(
        string toEmail,
        string verificationCode,
        TimeSpan expiresIn,
        CancellationToken cancellationToken = default)
    {
        logger.LogInformation(
            "Development email verification code for {ToEmail}: {VerificationCode}. Expires in {ExpirationMinutes} minutes.",
            toEmail,
            verificationCode,
            Math.Ceiling(expiresIn.TotalMinutes));

        return Task.CompletedTask;
    }
}
