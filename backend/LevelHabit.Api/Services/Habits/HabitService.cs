using System.Security.Claims;
using LevelHabit.Api.Contracts.Auth;
using LevelHabit.Api.Contracts.Habits;
using LevelHabit.Api.Data;
using LevelHabit.Api.Domain;
using LevelHabit.Api.Middleware;
using LevelHabit.Api.Services.Achievements;
using LevelHabit.Api.Services.Progress;
using LevelHabit.Api.Services.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace LevelHabit.Api.Services.Habits;

public sealed class HabitService(
    LevelHabitDbContext dbContext,
    TimeProvider timeProvider,
    IAchievementService achievementService) : IHabitService
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

    public async Task<IReadOnlyList<HabitResponse>> ListAsync(
        ClaimsPrincipal principal,
        bool includeArchived,
        CancellationToken cancellationToken)
    {
        Guid userId = GetCurrentUserId(principal);

        IQueryable<Habit> query = dbContext.Habits
            .AsNoTracking()
            .Where(habit => habit.UserId == userId);

        if (!includeArchived)
        {
            query = query.Where(habit => !habit.IsArchived);
        }

        List<Habit> habits = await query
            .OrderBy(habit => habit.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return await MapHabitsAsync(userId, habits, cancellationToken);
    }

    public async Task<HabitResponse> GetAsync(
        ClaimsPrincipal principal,
        Guid habitId,
        CancellationToken cancellationToken)
    {
        Guid userId = GetCurrentUserId(principal);
        Habit habit = await FindOwnedHabitAsync(userId, habitId, cancellationToken);

        return await MapHabitAsync(userId, habit, cancellationToken);
    }

    public async Task<HabitResponse> CreateAsync(
        ClaimsPrincipal principal,
        CreateHabitRequest request,
        CancellationToken cancellationToken)
    {
        Guid userId = GetCurrentUserId(principal);
        CleanHabitInput input = CleanAndValidate(request);
        DateTimeOffset now = timeProvider.GetUtcNow();

        Habit habit = new()
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

        dbContext.Habits.Add(habit);
        await dbContext.SaveChangesAsync(cancellationToken);

        return MapHabit(
            habit,
            completedTodayAtUtc: null,
            completedTodayXpAwarded: null,
            streak: new HabitStreak(
                CurrentStreak: 0,
                BestStreak: 0,
                LastCompletedDateUtc: null,
                LastCompletedAtUtc: null));
    }

    public async Task<HabitResponse> UpdateAsync(
        ClaimsPrincipal principal,
        Guid habitId,
        UpdateHabitRequest request,
        CancellationToken cancellationToken)
    {
        Guid userId = GetCurrentUserId(principal);
        Habit habit = await FindOwnedHabitAsync(userId, habitId, cancellationToken);

        if (habit.IsArchived)
        {
            throw HabitNotFound();
        }

        CleanHabitInput input = CleanAndValidate(request);

        habit.Title = input.Title;
        habit.Description = input.Description;
        habit.Category = input.Category;
        habit.Difficulty = input.Difficulty;
        habit.Frequency = input.Frequency;
        habit.UpdatedAtUtc = timeProvider.GetUtcNow();

        await dbContext.SaveChangesAsync(cancellationToken);

        return await MapHabitAsync(userId, habit, cancellationToken);
    }

    public async Task<HabitCompletionResponse> CompleteTodayAsync(
        ClaimsPrincipal principal,
        Guid habitId,
        CancellationToken cancellationToken)
    {
        Guid userId = GetCurrentUserId(principal);
        DateTimeOffset now = timeProvider.GetUtcNow();
        DateOnly todayUtc = ToUtcDate(now);

        await using IDbContextTransaction? transaction =
            dbContext.Database.IsRelational()
                ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
                : null;

        Habit habit = await FindOwnedHabitAsync(userId, habitId, cancellationToken);

        if (habit.IsArchived)
        {
            throw HabitNotFound();
        }

        HabitCompletion? existingCompletion = await FindCompletionAsync(
            userId,
            habitId,
            todayUtc,
            cancellationToken);

        if (existingCompletion is not null)
        {
            ProgressProfile existingProgressProfile = await FindProgressProfileAsync(
                userId,
                asNoTracking: true,
                cancellationToken);

            HabitResponse habitResponse = await MapHabitAsync(userId, habit, cancellationToken);

            return MapCompletion(
                existingCompletion,
                existingProgressProfile,
                wasAlreadyCompleted: true,
                habit: habitResponse);
        }

        ProgressProfile progressProfile = await FindProgressProfileAsync(
            userId,
            asNoTracking: false,
            cancellationToken);
        int xpAwarded = HabitXpRewards.GetRewardForDifficulty(habit.Difficulty);

        HabitCompletion completion = new()
        {
            UserId = userId,
            HabitId = habit.Id,
            CompletionDateUtc = todayUtc,
            CompletedAtUtc = now,
            XpAwarded = xpAwarded
        };

        progressProfile.TotalXp += xpAwarded;
        progressProfile.Level = ProgressCalculator.Calculate(progressProfile.TotalXp).Level;
        progressProfile.UpdatedAtUtc = now;

        dbContext.HabitCompletions.Add(completion);

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
                habitId,
                todayUtc,
                cancellationToken);

            if (existingCompletion is not null)
            {
                ProgressProfile existingProgressProfile = await FindProgressProfileAsync(
                    userId,
                    asNoTracking: true,
                    cancellationToken);

                HabitResponse habitResponse = await MapHabitAsync(userId, habit, cancellationToken);

                return MapCompletion(
                    existingCompletion,
                    existingProgressProfile,
                    wasAlreadyCompleted: true,
                    habit: habitResponse);
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

        HabitResponse completedHabitResponse = await MapHabitAsync(
            userId,
            habit,
            cancellationToken);

        return MapCompletion(
            completion,
            progressProfile,
            wasAlreadyCompleted: false,
            habit: completedHabitResponse);
    }

    public async Task ArchiveAsync(
        ClaimsPrincipal principal,
        Guid habitId,
        CancellationToken cancellationToken)
    {
        Guid userId = GetCurrentUserId(principal);
        Habit habit = await FindOwnedHabitAsync(userId, habitId, cancellationToken);

        if (habit.IsArchived)
        {
            return;
        }

        DateTimeOffset now = timeProvider.GetUtcNow();

        habit.IsArchived = true;
        habit.UpdatedAtUtc = now;

        HabitReminder? reminder = await dbContext.HabitReminders
            .SingleOrDefaultAsync(
                candidate => candidate.UserId == userId && candidate.HabitId == habit.Id,
                cancellationToken);

        if (reminder is not null)
        {
            reminder.IsEnabled = false;
            reminder.NextTriggerAtUtc = null;
            reminder.UpdatedAtUtc = now;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<Habit> FindOwnedHabitAsync(
        Guid userId,
        Guid habitId,
        CancellationToken cancellationToken)
    {
        Habit? habit = await dbContext.Habits
            .SingleOrDefaultAsync(
                candidate => candidate.Id == habitId && candidate.UserId == userId,
                cancellationToken);

        return habit ?? throw HabitNotFound();
    }

    private async Task<HabitCompletion?> FindCompletionAsync(
        Guid userId,
        Guid habitId,
        DateOnly completionDateUtc,
        CancellationToken cancellationToken)
    {
        return await dbContext.HabitCompletions
            .AsNoTracking()
            .SingleOrDefaultAsync(
                completion =>
                    completion.UserId == userId
                    && completion.HabitId == habitId
                    && completion.CompletionDateUtc == completionDateUtc,
                cancellationToken);
    }

    private async Task<ProgressProfile> FindProgressProfileAsync(
        Guid userId,
        bool asNoTracking,
        CancellationToken cancellationToken)
    {
        IQueryable<ProgressProfile> query = dbContext.ProgressProfiles;

        if (asNoTracking)
        {
            query = query.AsNoTracking();
        }

        ProgressProfile? progressProfile = await query.SingleOrDefaultAsync(
            profile => profile.UserId == userId,
            cancellationToken);

        return progressProfile ?? throw new ApiException(
            StatusCodes.Status404NotFound,
            "Progress profile not found",
            "The current user's progress profile could not be found.");
    }

    private async Task<IReadOnlyList<HabitResponse>> MapHabitsAsync(
        Guid userId,
        IReadOnlyList<Habit> habits,
        CancellationToken cancellationToken)
    {
        if (habits.Count == 0)
        {
            return [];
        }

        DateOnly todayUtc = GetTodayUtc();
        Guid[] habitIds = habits.Select(habit => habit.Id).ToArray();
        List<HabitCompletionSummary> completions = await dbContext.HabitCompletions
            .AsNoTracking()
            .Where(completion =>
                completion.UserId == userId
                && habitIds.Contains(completion.HabitId))
            .Select(completion => new HabitCompletionSummary(
                completion.HabitId,
                completion.CompletionDateUtc,
                completion.CompletedAtUtc,
                completion.XpAwarded
            ))
            .ToListAsync(cancellationToken);

        Dictionary<Guid, List<HabitCompletionSummary>> completionsByHabitId = completions
            .GroupBy(completion => completion.HabitId)
            .ToDictionary(
                group => group.Key,
                group => group.ToList());

        return habits
            .Select(habit =>
            {
                List<HabitCompletionSummary> habitCompletions =
                    completionsByHabitId.GetValueOrDefault(habit.Id) ?? [];
                HabitCompletionSummary? completionToday = habitCompletions
                    .Where(completion => completion.CompletionDateUtc == todayUtc)
                    .OrderByDescending(completion => completion.CompletedAtUtc)
                    .FirstOrDefault();
                HabitStreak streak = HabitStreakCalculator.Calculate(
                    habitCompletions.Select(completion => new HabitCompletionStreakEntry(
                        completion.CompletionDateUtc,
                        completion.CompletedAtUtc)),
                    todayUtc);

                return MapHabit(
                    habit,
                    completionToday?.CompletedAtUtc,
                    completionToday?.XpAwarded,
                    streak);
            })
            .ToList();
    }

    private async Task<HabitResponse> MapHabitAsync(
        Guid userId,
        Habit habit,
        CancellationToken cancellationToken)
    {
        DateOnly todayUtc = GetTodayUtc();
        List<HabitCompletionSummary> completions = await dbContext.HabitCompletions
            .AsNoTracking()
            .Where(completion =>
                completion.UserId == userId
                && completion.HabitId == habit.Id)
            .Select(completion => new HabitCompletionSummary(
                completion.HabitId,
                completion.CompletionDateUtc,
                completion.CompletedAtUtc,
                completion.XpAwarded))
            .ToListAsync(cancellationToken);

        HabitCompletionSummary? completionToday = completions
            .Where(completion => completion.CompletionDateUtc == todayUtc)
            .OrderByDescending(completion => completion.CompletedAtUtc)
            .FirstOrDefault();
        HabitStreak streak = HabitStreakCalculator.Calculate(
            completions.Select(completion => new HabitCompletionStreakEntry(
                completion.CompletionDateUtc,
                completion.CompletedAtUtc)),
            todayUtc);

        return MapHabit(
            habit,
            completionToday?.CompletedAtUtc,
            completionToday?.XpAwarded,
            streak);
    }

    private static HabitResponse MapHabit(
        Habit habit,
        DateTimeOffset? completedTodayAtUtc,
        int? completedTodayXpAwarded,
        HabitStreak streak)
    {
        return new HabitResponse(
            Id: habit.Id,
            UserId: habit.UserId,
            Title: habit.Title,
            Description: habit.Description,
            Category: habit.Category,
            Difficulty: habit.Difficulty,
            Frequency: habit.Frequency,
            XpReward: HabitXpRewards.GetRewardForDifficulty(habit.Difficulty),
            IsArchived: habit.IsArchived,
            CompletedToday: completedTodayAtUtc.HasValue,
            CompletedTodayXpAwarded: completedTodayXpAwarded,
            CompletedTodayAtUtc: completedTodayAtUtc,
            CurrentStreak: streak.CurrentStreak,
            BestStreak: streak.BestStreak,
            LastCompletedDateUtc: streak.LastCompletedDateUtc,
            LastCompletedAtUtc: streak.LastCompletedAtUtc,
            CreatedAtUtc: habit.CreatedAtUtc,
            UpdatedAtUtc: habit.UpdatedAtUtc);
    }

    private static HabitCompletionResponse MapCompletion(
        HabitCompletion completion,
        ProgressProfile progressProfile,
        bool wasAlreadyCompleted,
        HabitResponse habit)
    {
        return new HabitCompletionResponse(
            Id: completion.Id,
            HabitId: completion.HabitId,
            UserId: completion.UserId,
            CompletionDateUtc: completion.CompletionDateUtc,
            CompletedAtUtc: completion.CompletedAtUtc,
            XpAwarded: completion.XpAwarded,
            WasAlreadyCompleted: wasAlreadyCompleted,
            ProgressProfile: MapProgressProfile(progressProfile),
            Habit: habit);
    }

    private static ProgressProfileResponse MapProgressProfile(ProgressProfile progressProfile)
    {
        LevelProgress progress = ProgressCalculator.Calculate(progressProfile.TotalXp);

        return new ProgressProfileResponse(
            Id: progressProfile.Id,
            DisplayName: progressProfile.DisplayName,
            Level: progress.Level,
            TotalXp: progress.TotalXp,
            XpInCurrentLevel: progress.XpInCurrentLevel,
            XpRequiredForNextLevel: progress.XpRequiredForNextLevel,
            XpToNextLevel: progress.XpToNextLevel,
            CurrentStreak: progressProfile.CurrentStreak,
            CreatedAtUtc: progressProfile.CreatedAtUtc);
    }

    private static string Clean(string value) => value.Trim();

    private static string Canonicalize(string value, HashSet<string> allowedValues)
    {
        return allowedValues.Single(allowedValue =>
            string.Equals(allowedValue, value, StringComparison.OrdinalIgnoreCase));
    }

    private static ApiException HabitNotFound()
    {
        return new ApiException(
            StatusCodes.Status404NotFound,
            "Habit not found",
            "The requested habit could not be found.");
    }

    private sealed record CleanHabitInput(
        string Title,
        string Description,
        string Category,
        string Difficulty,
        string Frequency);

    private sealed record HabitCompletionSummary(
        Guid HabitId,
        DateOnly CompletionDateUtc,
        DateTimeOffset CompletedAtUtc,
        int XpAwarded);

    private static CleanHabitInput CleanAndValidate(CreateHabitRequest request)
    {
        return CleanAndValidate(
            request.Title,
            request.Description,
            request.Category,
            request.Difficulty,
            request.Frequency);
    }

    private static CleanHabitInput CleanAndValidate(UpdateHabitRequest request)
    {
        return CleanAndValidate(
            request.Title,
            request.Description,
            request.Category,
            request.Difficulty,
            request.Frequency);
    }

    private static CleanHabitInput CleanAndValidate(
        string title,
        string? description,
        string category,
        string difficulty,
        string frequency)
    {
        CleanHabitInput input = new(
            Title: Clean(title),
            Description: Clean(description ?? string.Empty),
            Category: Clean(category),
            Difficulty: Clean(difficulty),
            Frequency: Clean(frequency));

        Dictionary<string, string[]> errors = [];

        if (string.IsNullOrWhiteSpace(input.Title))
        {
            errors[nameof(CreateHabitRequest.Title)] = ["Title is required."];
        }

        if (!AllowedCategories.Contains(input.Category))
        {
            errors[nameof(CreateHabitRequest.Category)] =
            [
                "Category must be one of: Health, Fitness, Learning, Coding, Chores, Personal."
            ];
        }

        if (!AllowedDifficulties.Contains(input.Difficulty))
        {
            errors[nameof(CreateHabitRequest.Difficulty)] =
            [
                "Difficulty must be one of: Easy, Medium, Hard."
            ];
        }

        if (!AllowedFrequencies.Contains(input.Frequency))
        {
            errors[nameof(CreateHabitRequest.Frequency)] =
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
        return AuthenticatedUser.GetUserId(principal);
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
