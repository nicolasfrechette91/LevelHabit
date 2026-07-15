using System.Reflection;
using LevelHabit.Api.Controllers;
using Microsoft.AspNetCore.Authorization;

namespace LevelHabit.Api.Tests;

public sealed class HabitsControllerTests
{
    [Fact]
    public void Controller_requires_authorization()
    {
        Assert.Contains(
            typeof(HabitsController).GetCustomAttributes<AuthorizeAttribute>(),
            attribute => attribute.Policy is null);
    }

    [Fact]
    public void Habit_reminders_controller_requires_authorization()
    {
        Assert.Contains(
            typeof(HabitRemindersController).GetCustomAttributes<AuthorizeAttribute>(),
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
