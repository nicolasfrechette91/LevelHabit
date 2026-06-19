using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using LevelHabit.Api.Contracts.Auth;
using LevelHabit.Api.Contracts.Quests;
using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using LevelHabit.Api.Middleware;
using LevelHabit.Api.Services.Achievements;
using LevelHabit.Api.Services.Heroes;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace LevelHabit.Api.Services.Quests;

public sealed class QuestService(
    LevelHabitDbContext dbContext,
    TimeProvider timeProvider,
    IAchievementService achievementService) : IQuestService
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

        return MapQuest(
            quest,
            completedTodayAtUtc: null,
            completedTodayXpAwarded: null,
            streak: new QuestStreak(
                CurrentStreak: 0,
                BestStreak: 0,
                LastCompletedDateUtc: null,
                LastCompletedAtUtc: null));
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
        DateTimeOffset now = timeProvider.GetUtcNow();
        DateOnly todayUtc = ToUtcDate(now);

        await using IDbContextTransaction? transaction =
            dbContext.Database.IsRelational()
                ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
                : null;

        Quest quest = await FindOwnedQuestAsync(userId, questId, cancellationToken);

        if (quest.IsArchived)
        {
            throw QuestNotFound();
        }

        QuestCompletion? existingCompletion = await FindCompletionAsync(
            userId,
            questId,
            todayUtc,
            cancellationToken);

        if (existingCompletion is not null)
        {
            HeroProfile existingHeroProfile = await FindHeroProfileAsync(
                userId,
                asNoTracking: true,
                cancellationToken);

            QuestResponse questResponse = await MapQuestAsync(userId, quest, cancellationToken);

            return MapCompletion(
                existingCompletion,
                existingHeroProfile,
                wasAlreadyCompleted: true,
                quest: questResponse);
        }

        HeroProfile heroProfile = await FindHeroProfileAsync(
            userId,
            asNoTracking: false,
            cancellationToken);
        int xpAwarded = QuestXpRewards.GetRewardForDifficulty(quest.Difficulty);

        QuestCompletion completion = new()
        {
            UserId = userId,
            QuestId = quest.Id,
            CompletionDateUtc = todayUtc,
            CompletedAtUtc = now,
            XpAwarded = xpAwarded
        };

        heroProfile.TotalXp += xpAwarded;
        heroProfile.Level = HeroProgressCalculator.Calculate(heroProfile.TotalXp).Level;
        heroProfile.UpdatedAtUtc = now;

        dbContext.QuestCompletions.Add(completion);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            dbContext.ChangeTracker.Clear();

            existingCompletion = await FindCompletionAsync(
                userId,
                questId,
                todayUtc,
                cancellationToken);

            if (existingCompletion is not null)
            {
                HeroProfile existingHeroProfile = await FindHeroProfileAsync(
                    userId,
                    asNoTracking: true,
                    cancellationToken);

                QuestResponse questResponse = await MapQuestAsync(userId, quest, cancellationToken);

                return MapCompletion(
                    existingCompletion,
                    existingHeroProfile,
                    wasAlreadyCompleted: true,
                    quest: questResponse);
            }

            throw;
        }

        await achievementService.UnlockEligibleAsync(
            userId,
            now,
            cancellationToken);

        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        QuestResponse completedQuestResponse = await MapQuestAsync(
            userId,
            quest,
            cancellationToken);

        return MapCompletion(
            completion,
            heroProfile,
            wasAlreadyCompleted: false,
            quest: completedQuestResponse);
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

    private async Task<HeroProfile> FindHeroProfileAsync(
        Guid userId,
        bool asNoTracking,
        CancellationToken cancellationToken)
    {
        IQueryable<HeroProfile> query = dbContext.HeroProfiles;

        if (asNoTracking)
        {
            query = query.AsNoTracking();
        }

        HeroProfile? heroProfile = await query.SingleOrDefaultAsync(
            profile => profile.UserId == userId,
            cancellationToken);

        return heroProfile ?? throw new ApiException(
            StatusCodes.Status404NotFound,
            "Hero profile not found",
            "The current user's hero profile could not be found.");
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
        List<QuestCompletionSummary> completions = await dbContext.QuestCompletions
            .AsNoTracking()
            .Where(completion =>
                completion.UserId == userId
                && questIds.Contains(completion.QuestId))
            .Select(completion => new QuestCompletionSummary(
                completion.QuestId,
                completion.CompletionDateUtc,
                completion.CompletedAtUtc,
                completion.XpAwarded
            ))
            .ToListAsync(cancellationToken);

        Dictionary<Guid, List<QuestCompletionSummary>> completionsByQuestId = completions
            .GroupBy(completion => completion.QuestId)
            .ToDictionary(
                group => group.Key,
                group => group.ToList());

        return quests
            .Select(quest =>
            {
                List<QuestCompletionSummary> questCompletions =
                    completionsByQuestId.GetValueOrDefault(quest.Id) ?? [];
                QuestCompletionSummary? completionToday = questCompletions
                    .Where(completion => completion.CompletionDateUtc == todayUtc)
                    .OrderByDescending(completion => completion.CompletedAtUtc)
                    .FirstOrDefault();
                QuestStreak streak = QuestStreakCalculator.Calculate(
                    questCompletions.Select(completion => new QuestCompletionStreakEntry(
                        completion.CompletionDateUtc,
                        completion.CompletedAtUtc)),
                    todayUtc);

                return MapQuest(
                    quest,
                    completionToday?.CompletedAtUtc,
                    completionToday?.XpAwarded,
                    streak);
            })
            .ToList();
    }

    private async Task<QuestResponse> MapQuestAsync(
        Guid userId,
        Quest quest,
        CancellationToken cancellationToken)
    {
        DateOnly todayUtc = GetTodayUtc();
        List<QuestCompletionSummary> completions = await dbContext.QuestCompletions
            .AsNoTracking()
            .Where(completion =>
                completion.UserId == userId
                && completion.QuestId == quest.Id)
            .Select(completion => new QuestCompletionSummary(
                completion.QuestId,
                completion.CompletionDateUtc,
                completion.CompletedAtUtc,
                completion.XpAwarded))
            .ToListAsync(cancellationToken);

        QuestCompletionSummary? completionToday = completions
            .Where(completion => completion.CompletionDateUtc == todayUtc)
            .OrderByDescending(completion => completion.CompletedAtUtc)
            .FirstOrDefault();
        QuestStreak streak = QuestStreakCalculator.Calculate(
            completions.Select(completion => new QuestCompletionStreakEntry(
                completion.CompletionDateUtc,
                completion.CompletedAtUtc)),
            todayUtc);

        return MapQuest(
            quest,
            completionToday?.CompletedAtUtc,
            completionToday?.XpAwarded,
            streak);
    }

    private static QuestResponse MapQuest(
        Quest quest,
        DateTimeOffset? completedTodayAtUtc,
        int? completedTodayXpAwarded,
        QuestStreak streak)
    {
        return new QuestResponse(
            Id: quest.Id,
            UserId: quest.UserId,
            Title: quest.Title,
            Description: quest.Description,
            Category: quest.Category,
            Difficulty: quest.Difficulty,
            Frequency: quest.Frequency,
            XpReward: QuestXpRewards.GetRewardForDifficulty(quest.Difficulty),
            IsArchived: quest.IsArchived,
            CompletedToday: completedTodayAtUtc.HasValue,
            CompletedTodayXpAwarded: completedTodayXpAwarded,
            CompletedTodayAtUtc: completedTodayAtUtc,
            CurrentStreak: streak.CurrentStreak,
            BestStreak: streak.BestStreak,
            LastCompletedDateUtc: streak.LastCompletedDateUtc,
            LastCompletedAtUtc: streak.LastCompletedAtUtc,
            CreatedAtUtc: quest.CreatedAtUtc,
            UpdatedAtUtc: quest.UpdatedAtUtc);
    }

    private static QuestCompletionResponse MapCompletion(
        QuestCompletion completion,
        HeroProfile heroProfile,
        bool wasAlreadyCompleted,
        QuestResponse quest)
    {
        return new QuestCompletionResponse(
            Id: completion.Id,
            QuestId: completion.QuestId,
            UserId: completion.UserId,
            CompletionDateUtc: completion.CompletionDateUtc,
            CompletedAtUtc: completion.CompletedAtUtc,
            XpAwarded: completion.XpAwarded,
            WasAlreadyCompleted: wasAlreadyCompleted,
            HeroProfile: MapHeroProfile(heroProfile),
            Quest: quest);
    }

    private static HeroProfileResponse MapHeroProfile(HeroProfile heroProfile)
    {
        HeroProgress progress = HeroProgressCalculator.Calculate(heroProfile.TotalXp);

        return new HeroProfileResponse(
            Id: heroProfile.Id,
            HeroName: heroProfile.HeroName,
            Level: progress.Level,
            TotalXp: progress.TotalXp,
            XpInCurrentLevel: progress.XpInCurrentLevel,
            XpRequiredForNextLevel: progress.XpRequiredForNextLevel,
            XpToNextLevel: progress.XpToNextLevel,
            CurrentStreak: heroProfile.CurrentStreak,
            CreatedAtUtc: heroProfile.CreatedAtUtc);
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

    private sealed record QuestCompletionSummary(
        Guid QuestId,
        DateOnly CompletionDateUtc,
        DateTimeOffset CompletedAtUtc,
        int XpAwarded);

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
}
