using Microsoft.AspNetCore.Mvc;
using LevelHabit.Api.Observability;

namespace LevelHabit.Api.Middleware;

public sealed class ExceptionHandlingMiddleware(
    RequestDelegate next,
    IHostEnvironment environment,
    ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (ApiException exception)
        {
            await WriteProblemAsync(context, exception);
        }
        catch (Exception exception)
        {
            SentryErrorTracking.CaptureUnhandledException(
                context,
                environment,
                exception,
                StatusCodes.Status500InternalServerError);

            logger.LogError(exception, "Unhandled API exception.");

            ProblemDetails problemDetails = new()
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "Unexpected error",
                Detail = "An unexpected error occurred."
            };

            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await context.Response.WriteAsJsonAsync(problemDetails);
        }
    }

    private static async Task WriteProblemAsync(HttpContext context, ApiException exception)
    {
        ProblemDetails problemDetails = exception.Errors is null
            ? new ProblemDetails()
            : new ValidationProblemDetails(exception.Errors.ToDictionary());

        problemDetails.Status = exception.StatusCode;
        problemDetails.Title = exception.Title;
        problemDetails.Detail = exception.Detail;

        context.Response.StatusCode = exception.StatusCode;
        await context.Response.WriteAsJsonAsync(problemDetails);
    }
}
