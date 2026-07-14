using LevelHabit.Api.Contracts.Reminders;
using LevelHabit.Api.Services.Reminders;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LevelHabit.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/quests/{questId:guid}/reminder")]
public sealed class QuestRemindersController(IQuestReminderService reminderService)
    : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<QuestReminderResponse>> Get(
        Guid questId,
        CancellationToken cancellationToken)
    {
        QuestReminderResponse reminder = await reminderService.GetAsync(
            User,
            questId,
            cancellationToken);

        return Ok(reminder);
    }

    [HttpPut]
    public async Task<ActionResult<QuestReminderResponse>> Upsert(
        Guid questId,
        UpsertQuestReminderRequest request,
        CancellationToken cancellationToken)
    {
        QuestReminderResponse reminder = await reminderService.UpsertAsync(
            User,
            questId,
            request,
            cancellationToken);

        return Ok(reminder);
    }

    [HttpDelete]
    public async Task<IActionResult> Delete(
        Guid questId,
        CancellationToken cancellationToken)
    {
        await reminderService.DeleteAsync(User, questId, cancellationToken);

        return NoContent();
    }
}
