using LevelHabit.Api.Contracts.Quests;
using LevelHabit.Api.Services.Quests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LevelHabit.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public sealed class QuestsController(IQuestService questService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<QuestResponse>>> List(
        [FromQuery] bool includeArchived,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<QuestResponse> quests = await questService.ListAsync(
            User,
            includeArchived,
            cancellationToken);

        return Ok(quests);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<QuestResponse>> Get(
        Guid id,
        CancellationToken cancellationToken)
    {
        QuestResponse quest = await questService.GetAsync(User, id, cancellationToken);

        return Ok(quest);
    }

    [HttpPost]
    public async Task<ActionResult<QuestResponse>> Create(
        CreateQuestRequest request,
        CancellationToken cancellationToken)
    {
        QuestResponse quest = await questService.CreateAsync(
            User,
            request,
            cancellationToken);

        return CreatedAtAction(nameof(Get), new { id = quest.Id }, quest);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<QuestResponse>> Update(
        Guid id,
        UpdateQuestRequest request,
        CancellationToken cancellationToken)
    {
        QuestResponse quest = await questService.UpdateAsync(
            User,
            id,
            request,
            cancellationToken);

        return Ok(quest);
    }

    [HttpPost("{id:guid}/complete")]
    public async Task<ActionResult<QuestCompletionResponse>> CompleteToday(
        Guid id,
        CancellationToken cancellationToken)
    {
        QuestCompletionResponse completion = await questService.CompleteTodayAsync(
            User,
            id,
            cancellationToken);

        return Ok(completion);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Archive(
        Guid id,
        CancellationToken cancellationToken)
    {
        await questService.ArchiveAsync(User, id, cancellationToken);

        return NoContent();
    }
}
