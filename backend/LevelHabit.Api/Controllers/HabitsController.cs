using LevelHabit.Api.Contracts.Habits;
using LevelHabit.Api.Services.Habits;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LevelHabit.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public sealed class HabitsController(IHabitService habitService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<HabitResponse>>> List(
        [FromQuery] bool includeArchived,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<HabitResponse> habits = await habitService.ListAsync(
            User,
            includeArchived,
            cancellationToken);

        return Ok(habits);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<HabitResponse>> Get(
        Guid id,
        CancellationToken cancellationToken)
    {
        HabitResponse habit = await habitService.GetAsync(User, id, cancellationToken);

        return Ok(habit);
    }

    [HttpPost]
    public async Task<ActionResult<HabitResponse>> Create(
        CreateHabitRequest request,
        CancellationToken cancellationToken)
    {
        HabitResponse habit = await habitService.CreateAsync(
            User,
            request,
            cancellationToken);

        return CreatedAtAction(nameof(Get), new { id = habit.Id }, habit);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<HabitResponse>> Update(
        Guid id,
        UpdateHabitRequest request,
        CancellationToken cancellationToken)
    {
        HabitResponse habit = await habitService.UpdateAsync(
            User,
            id,
            request,
            cancellationToken);

        return Ok(habit);
    }

    [HttpPost("{id:guid}/complete")]
    public async Task<ActionResult<HabitCompletionResponse>> CompleteToday(
        Guid id,
        CancellationToken cancellationToken)
    {
        HabitCompletionResponse completion = await habitService.CompleteTodayAsync(
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
        await habitService.ArchiveAsync(User, id, cancellationToken);

        return NoContent();
    }
}
