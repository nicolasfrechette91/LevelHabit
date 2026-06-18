namespace LevelHabit.Api.Contracts.Auth;

public sealed record UserResponse(
    Guid Id,
    string Email,
    string DisplayName,
    DateTimeOffset CreatedAtUtc);
