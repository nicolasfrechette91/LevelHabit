using System.Reflection;
using LevelHabit.Api.Controllers;
using Microsoft.AspNetCore.Authorization;

namespace LevelHabit.Api.Tests;

public sealed class AchievementsControllerTests
{
    [Fact]
    public void Controller_requires_authorization()
    {
        Assert.Contains(
            typeof(AchievementsController).GetCustomAttributes<AuthorizeAttribute>(),
            attribute => attribute.Policy is null);
    }
}
