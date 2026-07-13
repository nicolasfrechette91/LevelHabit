namespace LevelHabit.Api.Services.Security;

public interface IEmailVerificationCodeService
{
    string GenerateCode();

    string HashCode(string normalizedEmail, string code);

    bool VerifyCode(string normalizedEmail, string code, string codeHash);
}
