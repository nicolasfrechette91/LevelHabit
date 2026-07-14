using System.Reflection;
using LevelHabit.Api.Controllers;
using Microsoft.AspNetCore.Authorization;

namespace LevelHabit.Api.Tests;

public sealed class QuestsControllerTests
{
    [Fact]
    public void Controller_requires_authorization()
    {
        Assert.Contains(
            typeof(QuestsController).GetCustomAttributes<AuthorizeAttribute>(),
            attribute => attribute.Policy is null);
    }

    [Fact]
    public void Quest_reminders_controller_requires_authorization()
    {
        Assert.Contains(
            typeof(QuestRemindersController).GetCustomAttributes<AuthorizeAttribute>(),
            attribute => attribute.Policy is null);
    }

    [Fact]
    public void Notifications_controller_requires_authorization()
    {
        Assert.Contains(
            typeof(NotificationsController).GetCustomAttributes<AuthorizeAttribute>(),
            attribute => attribute.Policy is null);
    }
}
