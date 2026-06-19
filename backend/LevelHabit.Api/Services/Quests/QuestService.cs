using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using LevelHabit.Api.Contracts.Quests;
using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using LevelHabit.Api.Middleware;
using Microsoft.EntityFrameworkCore;

namespace LevelHabit.Api.Services.Quests;

public sealed class QuestService(
    LevelHabitDbContext dbContext,
    TimeProvider timeProvider) : IQuestService
{
    private static readonly HashSet<string> AllowedCategories = new(StringComparer.OrdinalIgnoreCase)
    {
        "Health",
        "Fitness",
        "Learning",
        "Coding",
        "Chores",
        "Personal"
    };

    private static readonly HashSet<string> AllowedDifficulties = new(StringComparer.OrdinalIgnoreCase)
    {
        "Easy",
        "Medium",
        "Hard"
    };

    private static readonly HashSet<string> AllowedFrequencies = new(StringComparer.OrdinalIgnoreCase)
    {
        "Daily",
        "Weekdays",
        "Weekly",
        "Custom"
    };

    public async Task<IReadOnlyList<QuestResponse>> ListAsync(
        ClaimsPrincipal principal,
        bool includeArchived,
        CancellationToken cancellationToken)
    {
        Guid userId = GetCurrentUserId(principal);

        IQueryable<Quest> query = dbContext.Quests
            .AsNoTracking()
            .Where(quest => quest.UserId == userId);

        if (!includeArchived)
        {
            query = query.Where(quest => !quest.IsArchived);
        }

        List<Quest> quests = await query
            .OrderBy(quest => quest.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return await MapQuestsAsync(userId, quests, cancellationToken);
    }

    public async Task<QuestResponse> GetAsync(
        ClaimsPrincipal principal,
        Guid questId,
        CancellationToken cancellationToken)
    {
        Guid userId = GetCurrentUserId(principal);
        Quest quest = await FindOwnedQuestAsync(userId, questId, cancellationToken);

        return await MapQuestAsync(userId, quest, cancellationToken);
    }

    public async Task<QuestResponse> CreateAsync(
        ClaimsPrincipal principal,
        CreateQuestRequest request,
        CancellationToken cancellationToken)
    {
        Guid userId = GetCurrentUserId(principal);
        CleanQuestInput input = CleanAndValidate(request);
        DateTimeOffset now = timeProvider.GetUtcNow();

        Quest quest = new()
        {
            UserId = userId,
            Title = input.Title,
            Description = input.Description,
            Category = input.Category,
            Difficulty = input.Difficulty,
            Frequency = input.Frequency,
            IsArchived = false,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        dbContext.Quests.Add(quest);
        await dbContext.SaveChangesAsync(cancellationToken);

        return MapQuest(quest, completedTodayAtUtc: null);
    }

    public async Task<QuestResponse> UpdateAsync(
        ClaimsPrincipal principal,
        Guid questId,
        UpdateQuestRequest request,
        CancellationToken cancellationToken)
    {
        Guid userId = GetCurrentUserId(principal);
        Quest quest = await FindOwnedQuestAsync(userId, questId, cancellationToken);

        if (quest.IsArchived)
        {
            throw QuestNotFound();
        }

        CleanQuestInput input = CleanAndValidate(request);

        quest.Title = input.Title;
        quest.Description = input.Description;
        quest.Category = input.Category;
        quest.Difficulty = input.Difficulty;
        quest.Frequency = input.Frequency;
        quest.UpdatedAtUtc = timeProvider.GetUtcNow();

        await dbContext.SaveChangesAsync(cancellationToken);

        return await MapQuestAsync(userId, quest, cancellationToken);
    }

    public async Task<QuestCompletionResponse> CompleteTodayAsync(
        ClaimsPrincipal principal,
        Guid questId,
        CancellationToken cancellationToken)
    {
        Guid userId = GetCurrentUserId(principal);
        Quest quest = await FindOwnedQuestAsync(userId, questId, cancellationToken);

        if (quest.IsArchived)
        {
            throw QuestNotFound();
        }

        DateTimeOffset now = timeProvider.GetUtcNow();
        DateOnly todayUtc = ToUtcDate(now);
        QuestCompletion? existingCompletion = await FindCompletionAsync(
            userId,
            questId,
            todayUtc,
            cancellationToken);

        if (existingCompletion is not null)
        {
            return MapCompletion(existingCompletion);
        }

        QuestCompletion completion = new()
        {
            UserId = userId,
            QuestId = quest.Id,
            CompletionDateUtc = todayUtc,
            CompletedAtUtc = now
        };

        dbContext.QuestCompletions.Add(completion);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            dbContext.Entry(completion).State = EntityState.Detached;
            existingCompletion = await FindCompletionAsync(
                userId,
                questId,
                todayUtc,
                cancellationToken);

            if (existingCompletion is not null)
            {
                return MapCompletion(existingCompletion);
            }

            throw;
        }

        return MapCompletion(completion);
    }

    public async Task ArchiveAsync(
        ClaimsPrincipal principal,
        Guid questId,
        CancellationToken cancellationToken)
    {
        Guid userId = GetCurrentUserId(principal);
        Quest quest = await FindOwnedQuestAsync(userId, questId, cancellationToken);

        if (quest.IsArchived)
        {
            return;
        }

        quest.IsArchived = true;
        quest.UpdatedAtUtc = timeProvider.GetUtcNow();

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<Quest> FindOwnedQuestAsync(
        Guid userId,
        Guid questId,
        CancellationToken cancellationToken)
    {
        Quest? quest = await dbContext.Quests
            .SingleOrDefaultAsync(
                candidate => candidate.Id == questId && candidate.UserId == userId,
                cancellationToken);

        return quest ?? throw QuestNotFound();
    }

    private async Task<QuestCompletion?> FindCompletionAsync(
        Guid userId,
        Guid questId,
        DateOnly completionDateUtc,
        CancellationToken cancellationToken)
    {
        return await dbContext.QuestCompletions
            .AsNoTracking()
            .SingleOrDefaultAsync(
                completion =>
                    completion.UserId == userId
                    && completion.QuestId == questId
                    && completion.CompletionDateUtc == completionDateUtc,
                cancellationToken);
    }

    private async Task<IReadOnlyList<QuestResponse>> MapQuestsAsync(
        Guid userId,
        IReadOnlyList<Quest> quests,
        CancellationToken cancellationToken)
    {
        if (quests.Count == 0)
        {
            return [];
        }

        DateOnly todayUtc = GetTodayUtc();
        Guid[] questIds = quests.Select(quest => quest.Id).ToArray();
        Dictionary<Guid, DateTimeOffset> completionTimes = await dbContext.QuestCompletions
            .AsNoTracking()
            .Where(completion =>
                completion.UserId == userId
                && completion.CompletionDateUtc == todayUtc
                && questIds.Contains(completion.QuestId))
            .ToDictionaryAsync(
                completion => completion.QuestId,
                completion => completion.CompletedAtUtc,
                cancellationToken);

        return quests
            .Select(quest =>
            {
                DateTimeOffset? completedTodayAtUtc = completionTimes.TryGetValue(
                    quest.Id,
                    out DateTimeOffset completedAtUtc)
                    ? completedAtUtc
                    : null;

                return MapQuest(quest, completedTodayAtUtc);
            })
            .ToList();
    }

    private async Task<QuestResponse> MapQuestAsync(
        Guid userId,
        Quest quest,
        CancellationToken cancellationToken)
    {
        DateOnly todayUtc = GetTodayUtc();
        DateTimeOffset? completedTodayAtUtc = await dbContext.QuestCompletions
            .AsNoTracking()
            .Where(completion =>
                completion.UserId == userId
                && completion.QuestId == quest.Id
                && completion.CompletionDateUtc == todayUtc)
            .Select(completion => (DateTimeOffset?)completion.CompletedAtUtc)
            .SingleOrDefaultAsync(cancellationToken);

        return MapQuest(quest, completedTodayAtUtc);
    }

    private static CleanQuestInput CleanAndValidate(CreateQuestRequest request)
    {
        return CleanAndValidate(
            request.Title,
            request.Description,
            request.Category,
            request.Difficulty,
            request.Frequency);
    }

    private static CleanQuestInput CleanAndValidate(UpdateQuestRequest request)
    {
        return CleanAndValidate(
            request.Title,
            request.Description,
            request.Category,
            request.Difficulty,
            request.Frequency);
    }

    private static CleanQuestInput CleanAndValidate(
        string title,
        string? description,
        string category,
        string difficulty,
        string frequency)
    {
        CleanQuestInput input = new(
            Title: Clean(title),
            Description: Clean(description ?? string.Empty),
            Category: Clean(category),
            Difficulty: Clean(difficulty),
            Frequency: Clean(frequency));

        Dictionary<string, string[]> errors = [];

        if (string.IsNullOrWhiteSpace(input.Title))
        {
            errors[nameof(CreateQuestRequest.Title)] = ["Title is required."];
        }

        if (!AllowedCategories.Contains(input.Category))
        {
            errors[nameof(CreateQuestRequest.Category)] =
            [
                "Category must be one of: Health, Fitness, Learning, Coding, Chores, Personal."
            ];
        }

        if (!AllowedDifficulties.Contains(input.Difficulty))
        {
            errors[nameof(CreateQuestRequest.Difficulty)] =
            [
                "Difficulty must be one of: Easy, Medium, Hard."
            ];
        }

        if (!AllowedFrequencies.Contains(input.Frequency))
        {
            errors[nameof(CreateQuestRequest.Frequency)] =
            [
                "Frequency must be one of: Daily, Weekdays, Weekly, Custom."
            ];
        }

        if (errors.Count > 0)
        {
            throw new ApiValidationException(errors);
        }

        return input with
        {
            Category = Canonicalize(input.Category, AllowedCategories),
            Difficulty = Canonicalize(input.Difficulty, AllowedDifficulties),
            Frequency = Canonicalize(input.Frequency, AllowedFrequencies)
        };
    }

    private static Guid GetCurrentUserId(ClaimsPrincipal principal)
    {
        string? userIdValue = principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? principal.FindFirstValue(JwtRegisteredClaimNames.Sub);

        if (!Guid.TryParse(userIdValue, out Guid userId))
        {
            throw new ApiException(
                StatusCodes.Status401Unauthorized,
                "Unauthorized",
                "The current access token is missing a valid user identifier.");
        }

        return userId;
    }

    private DateOnly GetTodayUtc()
    {
        return ToUtcDate(timeProvider.GetUtcNow());
    }

    private static DateOnly ToUtcDate(DateTimeOffset timestamp)
    {
        return DateOnly.FromDateTime(timestamp.UtcDateTime);
    }

    private static QuestResponse MapQuest(
        Quest quest,
        DateTimeOffset? completedTodayAtUtc)
    {
        return new QuestResponse(
            Id: quest.Id,
            UserId: quest.UserId,
            Title: quest.Title,
            Description: quest.Description,
            Category: quest.Category,
            Difficulty: quest.Difficulty,
            Frequency: quest.Frequency,
            IsArchived: quest.IsArchived,
            CompletedToday: completedTodayAtUtc.HasValue,
            CompletedTodayAtUtc: completedTodayAtUtc,
            CreatedAtUtc: quest.CreatedAtUtc,
            UpdatedAtUtc: quest.UpdatedAtUtc);
    }

    private static QuestCompletionResponse MapCompletion(QuestCompletion completion)
    {
        return new QuestCompletionResponse(
            Id: completion.Id,
            QuestId: completion.QuestId,
            UserId: completion.UserId,
            CompletionDateUtc: completion.CompletionDateUtc,
            CompletedAtUtc: completion.CompletedAtUtc);
    }

    private static string Clean(string value) => value.Trim();

    private static string Canonicalize(string value, HashSet<string> allowedValues)
    {
        return allowedValues.Single(allowedValue =>
            string.Equals(allowedValue, value, StringComparison.OrdinalIgnoreCase));
    }

    private static ApiException QuestNotFound()
    {
        return new ApiException(
            StatusCodes.Status404NotFound,
            "Quest not found",
            "The requested quest could not be found.");
    }

    private sealed record CleanQuestInput(
        string Title,
        string Description,
        string Category,
        string Difficulty,
        string Frequency);
}
