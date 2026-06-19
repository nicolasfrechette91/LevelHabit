# LevelHabit

LevelHabit is a gamified habit tracker where users complete daily habits as
quests, earn XP, build streaks, unlock achievements, and level up a personal
hero profile over time.

The current MVP loop includes authentication, user-scoped quests, quest
completion tracking, XP rewards, basic hero leveling, streaks, achievements,
and analytics.

## Tech stack

- Angular 21 frontend with routing
- ASP.NET Core Web API targeting .NET 10
- Entity Framework Core with the Npgsql PostgreSQL provider
- PostgreSQL for local development and Supabase for production
- Docker Compose for the local database
- GitHub Pages for the frontend and Render for the backend

## Prerequisites

- .NET 10 SDK
- Node.js 20.19 or newer with npm
- Docker Desktop or another Docker Compose compatible runtime
- Git

## Project structure

```text
.
|-- backend/
|   |-- LevelHabit.Api/
|   |   |-- Controllers/
|   |   |-- Data/
|   |   |-- Migrations/
|   |   |-- Program.cs
|   |   `-- appsettings*.json
|   `-- LevelHabit.Api.Tests/
|-- frontend/
|   |-- public/
|   `-- src/
|       |-- app/
|       `-- environments/
|-- docker-compose.yml
|-- .env.example
`-- global.json
```

## Local setup

Create your local Docker environment file:

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

```powershell
cd backend/LevelHabit.Api
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=levelhabit;Username=levelhabit;Password=levelhabit_dev_password"
dotnet user-secrets set "Jwt:Secret" "replace-with-at-least-32-random-characters"
```

Apply local EF migrations. If `dotnet ef` is not installed yet, see the
database migration section below.

```powershell
dotnet ef database update
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
cd ../../frontend
npm install
npm start
```

The frontend runs at `http://localhost:4200`.
The backend runs at `http://localhost:5118`.
PostgreSQL is exposed locally on port `5432` by default.

## Configuration

- Root `.env` values are used by Docker Compose for PostgreSQL only.
- Local backend secrets belong in .NET user-secrets or temporary environment
  variables, not in source.
- `backend/LevelHabit.Api/appsettings.json` contains safe defaults and empty
  secret placeholders.
- `backend/LevelHabit.Api/appsettings.Example.json` shows the expected backend
  configuration shape.
- `frontend/src/environments/environment.development.ts` points Angular to
  `http://localhost:5118/api`.
- `frontend/src/environments/environment.ts` points the production GitHub Pages
  build to `https://level-habit-api.onrender.com/api`.
- Backend CORS must allow the exact frontend origin, currently
  `https://nicolasfrechette91.github.io`, plus `http://localhost:4200` for
  local development.

You can also use temporary PowerShell environment variables instead of
user-secrets for a single local session:

```powershell
$env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=5432;Database=levelhabit;Username=levelhabit;Password=levelhabit_dev_password"
$env:Jwt__Secret = "replace-with-at-least-32-random-characters"
```

## Render environment variables

Set these on the Render backend service. Use real values from Supabase and a
long random JWT secret; do not commit them.

```text
ConnectionStrings__DefaultConnection=<Supabase PostgreSQL connection string>
Jwt__Secret=<at least 32 random characters>
Jwt__Issuer=LevelHabit.Api
Jwt__Audience=LevelHabit.Frontend
Jwt__ExpirationMinutes=60
Cors__AllowedOrigins__0=https://nicolasfrechette91.github.io
Cors__AllowedOrigins__1=http://localhost:4200
```

The production frontend API URL is compiled from
`frontend/src/environments/environment.ts`. If the Render service URL changes,
update that file before rebuilding and redeploying the GitHub Pages frontend.

## Database migrations

Install the EF Core CLI if needed:

```powershell
dotnet tool install --global dotnet-ef
```

Apply migrations locally against Docker PostgreSQL:

```powershell
cd backend/LevelHabit.Api
dotnet ef database update
```

Apply migrations to Supabase before or during a Render release:

```powershell
cd backend/LevelHabit.Api
$env:ConnectionStrings__DefaultConnection = "<Supabase PostgreSQL connection string>"
$env:Jwt__Secret = "replace-with-at-least-32-random-characters"
dotnet ef database update
```

Production reminder: Supabase needs every EF migration in
`backend/LevelHabit.Api/Migrations`, including the authentication and hero
profile schema, quests, quest completions, completion XP, achievements, and the
tables used by analytics queries. If production has 500 responses around quests,
achievements, or analytics, check migrations first.

## CI/CD

GitHub Actions validates pull requests and pushes with:

- backend restore, build, and tests
- frontend `npm ci`
- Angular tests with `ng test --watch=false`
- Angular production build with the GitHub Pages base href

The same workflow deploys the frontend artifact to GitHub Pages on pushes to
`main` and manual `workflow_dispatch` runs. The Render backend still deploys
from the Render service configuration.

## Validation commands

Run these after installing prerequisites:

```powershell
dotnet test backend\LevelHabit.Api.Tests\LevelHabit.Api.Tests.csproj
```

```powershell
cd frontend
npm install
.\node_modules\.bin\ng.cmd test --watch=false
.\node_modules\.bin\ng.cmd build --configuration production
```

For the GitHub Pages build locally, include the repository base href:

```powershell
.\node_modules\.bin\ng.cmd build --configuration production --base-href /LevelHabit/
```

## Production smoke test

After Render deploys the backend and Supabase has the current migrations:

1. Open `https://nicolasfrechette91.github.io/LevelHabit/#/dashboard`.
2. Register a new account.
3. Log in.
4. Create a quest.
5. Complete the quest.
6. Verify XP and level updates.
7. Verify streaks update.
8. Verify achievements unlock when criteria are met.
9. Verify analytics reflects completions and XP.
10. Log out and log in again.
11. Verify the same user data persists.

## Production troubleshooting

- CORS failure: ensure `Cors__AllowedOrigins__0` on Render is exactly
  `https://nicolasfrechette91.github.io` with no path or trailing slash.
- Missing Supabase migration: run `dotnet ef database update` against the
  Supabase connection string and confirm all migrations are applied.
- Wrong API URL: confirm `frontend/src/environments/environment.ts` points to
  the Render API URL and the browser network tab calls that host.
- Expired or missing JWT: log out and log in again, then confirm API requests
  include an `Authorization: Bearer <token>` header.
- Render cold start: the first API request after inactivity can be slow or fail;
  retry after the service wakes up.

## Links

- Deployed frontend: https://nicolasfrechette91.github.io/LevelHabit/#/dashboard
- Production API base URL: https://level-habit-api.onrender.com/api

## Roadmap

1. Authentication and hero profile
2. Quest/habit management
3. XP and leveling
4. Streaks
5. Achievements
6. Analytics dashboard
7. Automated tests
8. CI/CD and deployment hardening
9. Notifications and reminders
