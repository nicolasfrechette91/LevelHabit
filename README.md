# LevelHabit

LevelHabit is a gamified habit tracker where users complete daily habits as quests,
earn XP, build streaks, unlock achievements, and level up a personal hero profile
over time.

This repository currently contains the initial full-stack project setup and the
authentication / hero profile milestone. Habit management, XP, streaks,
achievements, and analytics are still prototype-only.

## Tech stack

- Angular 21 frontend with routing
- ASP.NET Core Web API targeting .NET 10
- Entity Framework Core with the Npgsql PostgreSQL provider
- PostgreSQL for local development
- Docker Compose for the local database

## Prerequisites

- .NET 10 SDK
- Node.js 20.19 or newer with npm
- Docker Desktop or another Docker Compose compatible runtime
- Git

## Project structure

```text
.
├── backend/
│   └── LevelHabit.Api/
│       ├── Controllers/
│       ├── Data/
│       ├── Program.cs
│       └── appsettings*.json
├── frontend/
│   ├── public/
│   └── src/
│       ├── app/
│       └── environments/
├── docker-compose.yml
├── .env.example
└── global.json
```

## Local setup

Create your local environment file:

```powershell
Copy-Item .env.example .env
```

Start PostgreSQL:

```powershell
docker compose up -d
```

Check the database container:

```powershell
docker compose ps
```

Restore and build the backend:

```powershell
cd backend/LevelHabit.Api
dotnet restore
dotnet build
```

Configure the backend API for the current PowerShell session:

```powershell
$env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=5432;Database=<database>;Username=<user>;Password=<password>"
$env:Jwt__Secret = "replace-with-at-least-32-random-characters"
```

Run the backend API:

```powershell
dotnet run --launch-profile http
```

Check the health endpoint:

```powershell
curl http://localhost:5118/api/health
```

Install and run the frontend:

```powershell
cd frontend
npm install
npm start
```

Build the frontend:

```powershell
npm run build
```

The frontend runs at `http://localhost:4200`.
The backend runs at `http://localhost:5118`.
PostgreSQL is exposed locally on port `5432` by default.

## Configuration

- Root `.env` values are used by Docker Compose for PostgreSQL.
- `backend/LevelHabit.Api/appsettings.json` contains safe local defaults.
- `backend/LevelHabit.Api/appsettings.Example.json` shows the expected backend configuration shape.
- `frontend/src/environments/environment.development.ts` points Angular to the local API.
- `frontend/src/environments/environment.ts` keeps `authRequired` disabled so
  GitHub Pages can continue serving the frontend-only prototype without a live
  backend. Local development enables `authRequired` in
  `environment.development.ts`.

### Backend secrets

The API requires a PostgreSQL connection string and a JWT signing secret at
runtime. Do not commit real values. For local PowerShell sessions, set temporary
environment variables before running the API:

```powershell
$env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=5432;Database=<database>;Username=<user>;Password=<password>"
$env:Jwt__Secret = "replace-with-at-least-32-random-characters"
```

Alternatively, use .NET user secrets from `backend/LevelHabit.Api`:

```powershell
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=<database>;Username=<user>;Password=<password>"
dotnet user-secrets set "Jwt:Secret" "replace-with-at-least-32-random-characters"
```

## Database migrations

Install the EF Core CLI if needed:

```powershell
dotnet tool install --global dotnet-ef
```

Apply the authentication and hero profile schema:

```powershell
cd backend/LevelHabit.Api
dotnet ef database update
```

The current migration creates `users` and `hero_profiles`. Registering a user
automatically creates the related hero profile.

## Validation commands

Run these after installing the prerequisites:

```powershell
docker compose up -d
docker compose ps
cd backend/LevelHabit.Api
dotnet restore
dotnet build
dotnet test ../LevelHabit.Api.Tests/LevelHabit.Api.Tests.csproj
$env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=5432;Database=<database>;Username=<user>;Password=<password>"
$env:Jwt__Secret = "replace-with-at-least-32-random-characters"
dotnet run --launch-profile http
curl http://localhost:5118/api/health
cd ../../frontend
npm install
npm run test
npm run build
```

Website available here : https://nicolasfrechette91.github.io/LevelHabit/#/dashboard

## Roadmap

1. Authentication and hero profile
2. Quest/habit management
3. XP and leveling
4. Streaks
5. Achievements
6. Analytics dashboard
7. Automated tests
8. CI/CD
9. Deployment
