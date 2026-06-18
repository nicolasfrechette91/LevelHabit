namespace LevelHabit.Api.Middleware;

public sealed class ApiValidationException(
    IReadOnlyDictionary<string, string[]> errors)
    : ApiException(
        StatusCodes.Status400BadRequest,
        "Validation failed",
        "One or more validation errors occurred.",
        errors);
