# LevelHabit

LevelHabit is a gamified habit tracker where users complete daily habits as quests,
earn XP, build streaks, unlock achievements, and level up a personal hero profile
over time.

This repository currently contains the initial full-stack project setup only. It does
not yet implement authentication, habit management, XP, achievements, analytics, or
automated tests.

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

## Validation commands

Run these after installing the prerequisites:

```powershell
docker compose up -d
docker compose ps
cd backend/LevelHabit.Api
dotnet restore
dotnet build
dotnet run --launch-profile http
curl http://localhost:5118/api/health
cd ../../frontend
npm install
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
