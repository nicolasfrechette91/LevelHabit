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

    public Task SendPasswordResetEmailAsync(
        string toEmail,
        string resetUrl,
        CancellationToken cancellationToken = default)
    {
        string htmlContent = $"""
            <p>Hello,</p>
            <p>We received a request to reset your Level Habit password.</p>
            <p><a href="{WebUtility.HtmlEncode(resetUrl)}">Reset your password</a></p>
            <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
            """;
        string textContent = $"""
            Hello,

            We received a request to reset your Level Habit password.

            Reset your password:
            {resetUrl}

            This link expires in 1 hour. If you did not request this, you can ignore this email.
            """;

        return SendTransactionalEmailAsync(
            toEmail,
            "Reset your Level Habit password",
            htmlContent,
            textContent,
            cancellationToken);
    }

    public Task SendEmailVerificationCodeAsync(
        string toEmail,
        string verificationCode,
        TimeSpan expiresIn,
        CancellationToken cancellationToken = default)
    {
        int expirationMinutes = Math.Max(1, (int)Math.Ceiling(expiresIn.TotalMinutes));
        string encodedCode = WebUtility.HtmlEncode(verificationCode);
        string htmlContent = $"""
            <p>Hello,</p>
            <p>Use this Level Habit verification code to finish creating your account:</p>
            <p style="font-size: 28px; font-weight: 700; letter-spacing: 8px; margin: 24px 0;">{encodedCode}</p>
            <p>This code expires in {expirationMinutes} minutes.</p>
            <p>If you did not create a Level Habit account, you can ignore this email.</p>
            """;
        string textContent = $"""
            Hello,

            Use this Level Habit verification code to finish creating your account:

            {verificationCode}

            This code expires in {expirationMinutes} minutes.

            If you did not create a Level Habit account, you can ignore this email.
            """;

        return SendTransactionalEmailAsync(
            toEmail,
            "Verify your Level Habit email",
            htmlContent,
            textContent,
            cancellationToken);
    }

    private async Task SendTransactionalEmailAsync(
        string toEmail,
        string subject,
        string htmlContent,
        string textContent,
        CancellationToken cancellationToken)
    {
        BrevoEmailRequest request = new(
            Sender: new BrevoEmailAddress(
                Email: ResolveSenderEmail(),
                Name: ResolveSenderName()),
            To: [new BrevoEmailAddress(Email: toEmail)],
            Subject: subject,
            HtmlContent: htmlContent,
            TextContent: textContent);

        using HttpRequestMessage httpRequest = new(HttpMethod.Post, "smtp/email")
        {
            Content = JsonContent.Create(request)
        };

        httpRequest.Headers.Add("api-key", brevoOptions.ApiKey);

        using HttpResponseMessage response = await httpClient.SendAsync(
            httpRequest,
            cancellationToken);

        if (response.IsSuccessStatusCode)
        {
            return;
        }

        string responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        logger.LogError(
            "Brevo transactional email failed for {ToEmail}. StatusCode: {StatusCode}. Response: {ResponseBody}",
            toEmail,
            response.StatusCode,
            responseBody);

        throw new InvalidOperationException(
            $"Brevo transactional email failed with status code {(int)response.StatusCode}.");
    }

    private string ResolveSenderEmail()
    {
        return FirstNonBlank(brevoOptions.SenderEmail, brevoOptions.FromEmail)
            ?? string.Empty;
    }

    private string ResolveSenderName()
    {
        return FirstNonBlank(brevoOptions.SenderName, brevoOptions.FromName)
            ?? string.Empty;
    }

    private static string? FirstNonBlank(params string?[] values)
    {
        foreach (string? value in values)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return null;
    }

    private sealed record BrevoEmailRequest(
        [property: JsonPropertyName("sender")]
        BrevoEmailAddress Sender,
        [property: JsonPropertyName("to")]
        IReadOnlyList<BrevoEmailAddress> To,
        [property: JsonPropertyName("subject")]
        string Subject,
        [property: JsonPropertyName("htmlContent")]
        string HtmlContent,
        [property: JsonPropertyName("textContent")]
        string TextContent);

    private sealed record BrevoEmailAddress(
        [property: JsonPropertyName("email")]
        string Email,
        [property: JsonPropertyName("name")]
        string? Name = null);
}
