namespace LevelHabit.Api.Services.Email;

public interface IEmailSender
{
    Task SendPasswordResetEmailAsync(
        string toEmail,
        string resetUrl,
        CancellationToken cancellationToken = default);

    Task SendEmailVerificationCodeAsync(
        string toEmail,
        string verificationCode,
        TimeSpan expiresIn,
        CancellationToken cancellationToken = default);
}
