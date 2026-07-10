namespace LevelHabit.Api.Services.Email;

public sealed class DevelopmentEmailSender(
    ILogger<DevelopmentEmailSender> logger) : IEmailSender
{
    public Task SendPasswordResetEmailAsync(string toEmail, string resetUrl)
    {
        logger.LogInformation(
            "Development password reset email for {ToEmail}. Reset link: {ResetUrl}",
            toEmail,
            resetUrl);

        return Task.CompletedTask;
    }

    public Task SendEmailVerificationAsync(string toEmail, string verificationUrl)
    {
        logger.LogInformation(
            "Development email verification for {ToEmail}. Verification link: {VerificationUrl}",
            toEmail,
            verificationUrl);

        return Task.CompletedTask;
    }
}
