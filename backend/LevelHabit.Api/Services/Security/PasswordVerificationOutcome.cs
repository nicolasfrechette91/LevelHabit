namespace LevelHabit.Api.Services.Security;

public enum PasswordVerificationOutcome
{
    Failed,
    Success,
    SuccessRehashNeeded
}
