namespace LevelHabit.Api.Services.Email;

public sealed class BrevoOptions
{
    public const string SectionName = "Brevo";

    public string? ApiKey { get; set; }

    public string? FromEmail { get; set; }

    public string? FromName { get; set; }
}
