using LevelHabit.Api.Domain;

namespace LevelHabit.Api.Services.Security;

public sealed record CreatedRefreshToken(
    string PlaintextToken,
    RefreshToken Entity);
