# Level Habit

Level Habit is a production-deployed gamified habit tracker. Users create daily
habits, complete them for XP, build streaks, unlock achievements, and level up
a personal progress profile.

- Live demo: [LevelHabit on GitHub Pages](https://nicolasfrechette91.github.io/LevelHabit/)
- API health check: [Render API health endpoint](https://level-habit-api.onrender.com/api/health)

## Feature Summary

- Registration with six-digit email verification, login, logout, short-lived
  JWT access tokens, refresh-token rotation, password reset, protected API
  endpoints, and authenticated frontend routes.
- User-scoped habits with create, update, archive, and complete-today flows.
- Habit reminders, in-app notifications, a notification center, and optional
  browser notifications while the app is open.
- XP rewards, level progression, streak calculations, and achievement
  unlocks based on completion history.
- Analytics summary data for recent completions, XP, streaks, and activity.
- Production backend health warmup from the frontend to reduce Render cold-start
  friction.
- Backend and frontend validation through GitHub Actions.

## Technical Highlights

- Production full-stack deployment across GitHub Pages, Render, and Neon
  PostgreSQL.
- User-scoped data isolation for habits, completions, achievements, progress
  profiles, analytics, reminders, and notifications.
- JWT authentication with access tokens, rotating refresh tokens, server-side
  token revocation, one-time auth tokens, route guards, and token-bearing HTTP
  requests.
- EF Core migrations for PostgreSQL schema changes in local and production
  environments.
- Gamified progression loop covering XP rewards, levels, streaks,
  achievements, and analytics.
- Automated backend and frontend tests.
- CI/CD workflow for validation, GitHub Pages deployment, and Render deploy
  hook triggering.
- Responsive Angular frontend with mobile polish work already applied.

## Tech Stack

- Angular 21, TypeScript, Angular Router, HTTP services, route guards, SCSS, and
  Bootstrap utilities.
- ASP.NET Core Web API on .NET 10.
- Entity Framework Core with the Npgsql PostgreSQL provider.
- PostgreSQL locally through Docker Compose.
- Neon-hosted PostgreSQL in production.
- GitHub Pages for the production frontend.
- Render for the production backend API.
- GitHub Actions for CI, frontend deployment, and Render deploy hook triggering.

## Screenshots

Screenshots are not committed yet. Capture real screenshots from the production
deployment with a demo account and non-sensitive sample data, then save them
under `docs/screenshots/`.

Expected screenshot paths:

| View | Path |
| --- | --- |
| Login or register | `docs/screenshots/login.png` |
| Dashboard with progress | `docs/screenshots/dashboard.png` |
| Habits with a completed habit | `docs/screenshots/habits.png` |
| Achievements with at least one unlock | `docs/screenshots/achievements.png` |
| Analytics with real activity data | `docs/screenshots/analytics.png` |
| Mobile dashboard | `docs/screenshots/mobile-dashboard.png` |

After those PNG files exist, replace this placeholder table with Markdown image
tags or a compact gallery. See [docs/screenshots.md](docs/screenshots.md) for
capture sizes, sample data setup, naming, and privacy reminders.

## CI/CD And Deployment Notes

GitHub Actions runs on pull requests, pushes, and manual `workflow_dispatch`
runs.

- Backend job: restore, build, and test
  `backend/LevelHabit.Api.Tests/LevelHabit.Api.Tests.csproj`.
- Frontend job: `npm ci`, Angular unit tests, and production build with
  `--base-href /LevelHabit/`.
- Deploy job: publishes the built Angular artifact to GitHub Pages on `main`
  and manual runs.
- Render deploy job: triggers the Render backend deploy hook on `main` and
  manual runs when `RENDER_DEPLOY_HOOK_URL` is configured as a GitHub secret.
- EF Core migrations are applied with `dotnet ef database update`; the workflow
  does not automatically run production database migrations.