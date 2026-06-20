using System.Globalization;
using Sentry;
using Sentry.AspNetCore;
using Sentry.Extensibility;

namespace LevelHabit.Api.Observability;

public static class SentryErrorTracking
{
    private const string ServiceName = "levelhabit-api";

    public static void Configure(
        WebHostBuilderContext context,
        SentryAspNetCoreOptions options)
    {
        options.Environment = context.Configuration["Sentry:Environment"]
            ?? context.HostingEnvironment.EnvironmentName;
        options.SendDefaultPii = false;
        options.ServerName = null;
        options.MaxRequestBodySize = RequestSize.None;
        options.CaptureFailedRequests = false;
        options.MinimumBreadcrumbLevel = LogLevel.None;
        options.MinimumEventLevel = LogLevel.None;
        options.DefaultTags["service.name"] = ServiceName;
        options.SetBeforeSend(ScrubEvent);
    }

    public static void CaptureUnhandledException(
        HttpContext context,
        IHostEnvironment environment,
        Exception exception,
        int statusCode)
    {
        SentrySdk.CaptureException(exception, scope =>
        {
            scope.SetTag("service.name", ServiceName);
            scope.SetTag("environment", environment.EnvironmentName);
            scope.SetTag("request.method", context.Request.Method);
            scope.SetTag("request.path", context.Request.Path.Value ?? string.Empty);
            scope.SetTag(
                "http.status_code",
                statusCode.ToString(CultureInfo.InvariantCulture));

            scope.SetExtra("status_code", statusCode);
        });
    }

    private static SentryEvent ScrubEvent(SentryEvent sentryEvent)
    {
        sentryEvent.ServerName = null;
        sentryEvent.User = null!;

        if (sentryEvent.Request is not null)
        {
            sentryEvent.Request.Data = null!;
            sentryEvent.Request.Cookies = null;
            sentryEvent.Request.QueryString = null;
            sentryEvent.Request.Headers.Clear();
            sentryEvent.Request.Url = StripQueryString(sentryEvent.Request.Url);
        }

        return sentryEvent;
    }

    private static string? StripQueryString(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return url;
        }

        if (Uri.TryCreate(url, UriKind.Absolute, out Uri? uri))
        {
            return uri.GetLeftPart(UriPartial.Path);
        }

        int queryIndex = url.IndexOf('?', StringComparison.Ordinal);
        return queryIndex < 0 ? url : url[..queryIndex];
    }
}
