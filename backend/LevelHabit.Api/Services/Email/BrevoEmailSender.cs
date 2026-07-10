using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace LevelHabit.Api.Services.Email;

public sealed class BrevoEmailSender(
    HttpClient httpClient,
    IOptions<BrevoOptions> brevoOptions,
    ILogger<BrevoEmailSender> logger) : IEmailSender
{
    public static readonly Uri ApiBaseUri = new("https://api.brevo.com/v3/");

    private readonly BrevoOptions brevoOptions = brevoOptions.Value;

    public Task SendPasswordResetEmailAsync(string toEmail, string resetUrl)
    {
        string htmlContent = $"""
            <p>Hello,</p>
            <p>We received a request to reset your LevelHabit password.</p>
            <p><a href="{WebUtility.HtmlEncode(resetUrl)}">Reset your password</a></p>
            <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
            """;

        return SendTransactionalEmailAsync(
            toEmail,
            "Reset your LevelHabit password",
            htmlContent);
    }

    public Task SendEmailVerificationAsync(string toEmail, string verificationUrl)
    {
        string htmlContent = $"""
            <p>Hello,</p>
            <p>Please verify your email address to finish setting up LevelHabit.</p>
            <p><a href="{WebUtility.HtmlEncode(verificationUrl)}">Verify your email</a></p>
            <p>This link expires in 24 hours.</p>
            """;

        return SendTransactionalEmailAsync(
            toEmail,
            "Verify your LevelHabit email",
            htmlContent);
    }

    private async Task SendTransactionalEmailAsync(
        string toEmail,
        string subject,
        string htmlContent)
    {
        BrevoEmailRequest request = new(
            Sender: new BrevoEmailAddress(
                Email: brevoOptions.FromEmail ?? string.Empty,
                Name: brevoOptions.FromName ?? string.Empty),
            To: [new BrevoEmailAddress(Email: toEmail)],
            Subject: subject,
            HtmlContent: htmlContent);

        using HttpRequestMessage httpRequest = new(HttpMethod.Post, "smtp/email")
        {
            Content = JsonContent.Create(request)
        };

        httpRequest.Headers.Add("api-key", brevoOptions.ApiKey);

        using HttpResponseMessage response = await httpClient.SendAsync(httpRequest);

        if (response.IsSuccessStatusCode)
        {
            return;
        }

        string responseBody = await response.Content.ReadAsStringAsync();

        logger.LogError(
            "Brevo transactional email failed for {ToEmail}. StatusCode: {StatusCode}. Response: {ResponseBody}",
            toEmail,
            response.StatusCode,
            responseBody);

        throw new InvalidOperationException(
            $"Brevo transactional email failed with status code {(int)response.StatusCode}.");
    }

    private sealed record BrevoEmailRequest(
        [property: JsonPropertyName("sender")]
        BrevoEmailAddress Sender,
        [property: JsonPropertyName("to")]
        IReadOnlyList<BrevoEmailAddress> To,
        [property: JsonPropertyName("subject")]
        string Subject,
        [property: JsonPropertyName("htmlContent")]
        string HtmlContent);

    private sealed record BrevoEmailAddress(
        [property: JsonPropertyName("email")]
        string Email,
        [property: JsonPropertyName("name")]
        string? Name = null);
}
