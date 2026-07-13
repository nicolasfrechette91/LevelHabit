namespace LevelHabit.Api.Contracts.Auth;

public sealed record RegisterResponse(
    string Email,
    bool RequiresEmailVerification,
    string Message);
