# LevelHabit Case Study

## Project Overview

LevelHabit is a full-stack gamified habit tracker. Users create daily habits,
complete them for XP, build streaks, unlock achievements, and level up a hero
profile that represents their progress.

The project is deployed end to end with an Angular frontend on GitHub Pages, an
ASP.NET Core API on Render, and PostgreSQL hosted on Neon. It was built as
a focused MVP to demonstrate product thinking, secure user-scoped data,
backend API design, frontend integration, automated tests, and production
deployment.

## Problem Solved

Many habit trackers make it easy to list habits but do not give users a strong
sense of progression. LevelHabit explores a lightweight game loop for habit
tracking: complete useful daily actions, receive feedback immediately, and see
progress accumulate through XP, levels, streaks, achievements, and analytics.

The technical goal was to build this loop as a real deployed application rather
than a static prototype. That meant handling authentication, persistence,
database migrations, frontend routing, production configuration, and CI/CD.

## Product Features

- Authentication with registration, login, JWT-protected API routes, and
  authenticated frontend routes.
- Hero profile progression based on XP and level calculations.
- Habit management for creating, updating, archiving, and completing habits.
- Daily completion tracking with XP rewards.
- Streak calculations based on completion history.
- Achievement unlocks tied to user activity.
- Analytics dashboard summarizing completion and progress data.
- User data isolation so each account only sees its own habits, completions,
  achievements, and analytics.
- Frontend validation for common user input flows.
- Production deployment with documented smoke checks.

## Technical Architecture

The frontend is an Angular application served as static assets from GitHub
Pages. It uses hash routing and a `/LevelHabit/` base href so direct navigation
works in the GitHub Pages environment.

The backend is an ASP.NET Core Web API hosted on Render. It exposes controllers
for authentication, habits, achievements, analytics, and health checks. The API
uses JWT bearer authentication, CORS configuration for local and production
origins, service classes for business logic, and Entity Framework Core for data
access.

PostgreSQL is used in both local and production environments. Local development
uses Docker Compose. Production uses Neon-hosted PostgreSQL. EF Core migrations
manage schema changes across authentication, hero profiles, habits, habit
completions, XP rewards, achievements, and analytics-related data.

## Backend Design

The backend is organized around ASP.NET Core controllers, domain entities,
service classes, contracts, and EF Core configuration.

- Controllers keep HTTP concerns focused on routing, authorization, status
  codes, and request/response contracts.
- Services contain the application logic for authentication, habit workflows,
  XP rewards, streak calculations, achievements, and analytics.
- EF Core maps domain entities to PostgreSQL tables and applies migrations.
- Middleware centralizes API error handling and validation responses.
- Authentication uses password hashing and signed JWT access tokens.
- User-scoped queries filter data by the authenticated user to prevent
  cross-account data access.

This structure keeps the MVP simple while still separating HTTP, business
logic, persistence, and security concerns.

## Frontend Design

The frontend is an Angular 21 application with route-based views for login,
registration, dashboard, hero/profile, habits, achievements, and analytics.

- Auth guards protect application routes.
- An HTTP interceptor attaches JWT bearer tokens to API requests.
- API services isolate backend communication for authentication, habits,
  achievements, analytics, and health checks.
- Frontend validation handles basic form requirements before requests are sent.
- SCSS and Bootstrap utilities provide a consistent responsive interface.
- The auth page calls the backend health endpoint to help wake the Render API
  before the user submits credentials.

The frontend is intentionally direct and readable rather than over-abstracted.
That makes the core product loop easy to follow and maintain.

## Database Design

The database model centers on users and their progress data.

- `User` stores account identity and authentication-related data.
- `HeroProfile` stores user progress such as XP and level.
- `Habit` stores user-owned habits.
- `HabitCompletion` records daily completions and XP awarded.
- `Achievement` stores achievement definitions.
- `UserAchievement` stores which achievements each user has unlocked.

The important design concern is ownership. User-owned tables are associated
with a user, and API queries are scoped to the authenticated user. This was a
key production fix because habit, progress, and analytics data must not leak
between accounts.

## Authentication And Security Considerations

Security choices for the MVP include:

- Password hashing instead of storing plaintext passwords.
- JWT bearer tokens with issuer, audience, lifetime, and signing key
  validation.
- Rotating refresh tokens stored only as SHA-256 hashes, with server-side
  revocation and reuse protection.
- A minimum-length JWT secret validator to catch unsafe configuration.
- CORS configured with explicit local and production frontend origins.
- Server-side authorization on protected controllers.
- User-scoped data access in backend services.
- Password reset links and six-digit email verification codes delivered by
  Brevo, with local development logging for safe testing.
- Secrets stored in user-secrets, environment variables, Render settings, or
  GitHub secrets rather than committed source files.

Known security-related future work includes httpOnly cookie exploration for
same-site deployments and broader end-to-end authentication tests.

## Testing Strategy

The project includes automated backend and frontend tests.

Backend tests use xUnit and cover authentication, habit services/controllers,
achievement logic, analytics logic, and hero progression calculations. These
tests help protect the user-scoped business rules and core progression loop.

Frontend tests use Angular's test runner with Vitest and cover routing,
authentication helpers, API services, state behavior, and key component
behavior.

GitHub Actions runs both test suites on pull requests and pushes:

```powershell
dotnet test backend\LevelHabit.Api.Tests\LevelHabit.Api.Tests.csproj
cd frontend
npm test
```

## Deployment Strategy

The production deployment uses separate services:

- GitHub Pages serves the Angular frontend.
- Render hosts the ASP.NET Core backend.
- Neon hosts the PostgreSQL production database.
- GitHub Actions validates backend and frontend changes.
- The frontend deploys automatically from GitHub Actions on `main` and manual
  workflow runs.
- The backend deploy can be triggered by a Render deploy hook stored as the
  `RENDER_DEPLOY_HOOK_URL` GitHub secret.

Database migrations are applied with EF Core against the Neon connection
string before or during production releases.

## Key Challenges Solved

- Moving from a local MVP to a real production deployment across GitHub Pages,
  Render, and Neon.
- Configuring frontend and backend environments so local development and
  production use the correct API origins.
- Implementing authentication with JWT tokens and protected frontend/backend
  routes.
- Fixing user data isolation so one account cannot see another account's
  habits, completions, achievements, or analytics.
- Coordinating XP, leveling, streaks, achievements, and analytics around the
  same habit completion data.
- Documenting a production smoke checklist to catch deployment or migration
  problems quickly.
- Adding a health endpoint warmup flow to reduce friction from Render cold
  starts.

## What I Would Improve Next

- Explore httpOnly cookie storage for a same-site deployment architecture.
- Add notifications or reminders for habit follow-through.
- Improve mobile layout polish and touch ergonomics.
- Expand analytics with richer charts and trend comparisons.
- Add broader end-to-end tests against realistic user flows.
- Add performance monitoring.
- Capture and commit polished screenshots for README and portfolio use.
