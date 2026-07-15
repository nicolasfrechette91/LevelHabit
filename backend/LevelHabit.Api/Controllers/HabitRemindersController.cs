using LevelHabit.Api.Contracts.Reminders;
using LevelHabit.Api.Services.Reminders;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LevelHabit.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/habits/{habitId:guid}/reminder")]
public sealed class HabitRemindersController(IHabitReminderService reminderService)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<HabitReminderResponse>> Get(
        Guid habitId,
        CancellationToken cancellationToken)
    {
        HabitReminderResponse reminder = await reminderService.GetAsync(
            User,
            habitId,
            cancellationToken);

        return Ok(reminder);
    }

    [HttpPut]
    public async Task<ActionResult<HabitReminderResponse>> Upsert(
        Guid habitId,
        UpsertHabitReminderRequest request,
        CancellationToken cancellationToken)
    {
        HabitReminderResponse reminder = await reminderService.UpsertAsync(
            User,
            habitId,
            request,
            cancellationToken);

        return Ok(reminder);
    }

    [HttpDelete]
    public async Task<IActionResult> Delete(
        Guid habitId,
        CancellationToken cancellationToken)
    {
        await reminderService.DeleteAsync(User, habitId, cancellationToken);

        return NoContent();
    }
}
