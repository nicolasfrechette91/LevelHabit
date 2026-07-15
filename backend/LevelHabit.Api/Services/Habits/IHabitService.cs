using System.Security.Claims;
using LevelHabit.Api.Contracts.Habits;

namespace LevelHabit.Api.Services.Habits;

public interface IHabitService
{
    Task<IReadOnlyList<HabitResponse>> ListAsync(
        ClaimsPrincipal principal,
        bool includeArchived,
        CancellationToken cancellationToken);

    Task<HabitResponse> GetAsync(
        ClaimsPrincipal principal,
        Guid habitId,
        CancellationToken cancellationToken);

    Task<HabitResponse> CreateAsync(
        ClaimsPrincipal principal,
        CreateHabitRequest request,
        CancellationToken cancellationToken);

    Task<HabitResponse> UpdateAsync(
        ClaimsPrincipal principal,
        Guid habitId,
        UpdateHabitRequest request,
        CancellationToken cancellationToken);

    Task<HabitCompletionResponse> CompleteTodayAsync(
        ClaimsPrincipal principal,
        Guid habitId,
        CancellationToken cancellationToken);

    Task ArchiveAsync(
        ClaimsPrincipal principal,
        Guid habitId,
        CancellationToken cancellationToken);
}
