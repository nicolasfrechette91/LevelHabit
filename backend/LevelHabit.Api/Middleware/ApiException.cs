namespace LevelHabit.Api.Middleware;

public class ApiException : Exception
{
    public ApiException(
        int statusCode,
        string title,
        string? detail = null,
        IReadOnlyDictionary<string, string[]>? errors = null,
        string? code = null)
        : base(detail ?? title)
    {
        StatusCode = statusCode;
        Title = title;
        Detail = detail;
        Errors = errors;
        Code = code;
    }

    public int StatusCode { get; }

    public string Title { get; }

    public string? Detail { get; }

    public IReadOnlyDictionary<string, string[]>? Errors { get; }

    public string? Code { get; }
}
