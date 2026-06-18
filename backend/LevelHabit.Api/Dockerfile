FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY LevelHabit.Api.csproj ./
RUN dotnet restore

COPY . ./
RUN dotnet publish LevelHabit.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:10000
EXPOSE 10000

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "LevelHabit.Api.dll"]