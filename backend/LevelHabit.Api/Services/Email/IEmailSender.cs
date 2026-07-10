namespace LevelHabit.Api.Services.Email;

public interface IEmailSender
{
    Task SendPasswordResetEmailAsync(string toEmail, string resetUrl);

    Task SendEmailVerificationAsync(string toEmail, string verificationUrl);
}
