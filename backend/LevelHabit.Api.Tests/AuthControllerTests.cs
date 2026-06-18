using System.Reflection;
using LevelHabit.Api.Controllers;
using Microsoft.AspNetCore.Authorization;

namespace LevelHabit.Api.Tests;

public sealed class AuthControllerTests
{
    [Fact]
    public void Me_endpoint_requires_authorization()
    {
        MethodInfo method = typeof(AuthController).GetMethod(nameof(AuthController.Me))
            ?? throw new InvalidOperationException("AuthController.Me could not be found.");

        Assert.Contains(
            method.GetCustomAttributes<AuthorizeAttribute>(),
            attribute => attribute.Policy is null);
    }
}
