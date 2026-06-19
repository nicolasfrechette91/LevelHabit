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
}
