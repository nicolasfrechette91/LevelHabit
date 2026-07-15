using System.Security.Claims;
using LevelHabit.Api.Contracts.Reminders;

namespace LevelHabit.Api.Services.Reminders;

public interface IHabitReminderService
{
    Task<HabitReminderResponse> GetAsync(
        ClaimsPrincipal principal,
        Guid habitId,
        CancellationToken cancellationToken);

    Task<HabitReminderResponse> UpsertAsync(
        ClaimsPrincipal principal,
        Guid habitId,
        UpsertHabitReminderRequest request,
        CancellationToken cancellationToken);

    Task DeleteAsync(
        ClaimsPrincipal principal,
        Guid habitId,
        CancellationToken cancellationToken);
}
