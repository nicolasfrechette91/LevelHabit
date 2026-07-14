namespace LevelHabit.Api.Contracts.Auth;

public sealed record MeResponse(
    UserResponse User,
    ProgressProfileResponse ProgressProfile);
