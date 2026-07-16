# Level Habit

Level Habit is a production-deployed gamified habit tracker. Users create daily
habits, complete them for XP, build streaks, unlock achievements, and level up
a personal progress profile.

- Live demo: [LevelHabit on GitHub Pages](https://nicolasfrechette91.github.io/LevelHabit/)
- API health check: [Render API health endpoint](https://level-habit-api.onrender.com/api/health)

## At A Glance

LevelHabit is built as a real full-stack MVP rather than a static prototype. It
combines an Angular frontend, an ASP.NET Core API, PostgreSQL persistence,
JWT-based authentication, EF Core migrations, automated tests, and CI/CD-backed
production deployment.

The core product loop is intentionally simple: create habits, complete them
daily, earn XP, maintain streaks, unlock achievements, and inspect progress in
the analytics view.

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

## Reminders And Notifications

Habit reminders are stored per authenticated user and habit. Each habit can have
at most one reminder configuration with an enabled flag, one local `HH:mm`
reminder time, an IANA timezone id such as `America/Toronto`, and selected days
of the week. The database stores the local wall-clock time separately from the
IANA timezone id, plus a UTC `NextTriggerAtUtc` value for efficient processing.
This keeps daylight-saving-time behavior correct without storing only a UTC
offset.

Reminder days are stored as a weekday bitmask. Invalid local times during a
spring daylight-saving transition are moved forward to the next valid local
minute. Ambiguous fall daylight-saving times consistently use the offset that
produces the later UTC occurrence.

The backend runs a scoped `BackgroundService` once per minute while the Render
API service is running. It finds due enabled reminders, locks due rows with
PostgreSQL `FOR UPDATE SKIP LOCKED`, confirms the habit still belongs to the
user and is not archived, creates an in-app notification, and advances the next
future trigger. Reminder notifications use a deterministic deduplication key:
`habit-reminder:{reminderId}:{scheduledUtcTimestamp}`. A unique database index
prevents duplicates for the same scheduled reminder occurrence.

Archived habits do not create future notifications. Archiving a habit disables
its reminder and clears its next trigger. Restoring a habit does not
automatically re-enable the previous reminder.

In-app notifications are stored in Level Habit and shown in the authenticated
header notification center. Browser notifications are optional and require the
user to click `Enable browser notifications`. They use the browser
Notifications API only while Level Habit is open. This version does not implement
service workers, background web push, email, SMS, Firebase, SignalR, Hangfire,
Quartz, Redis, snoozing, or multiple reminder times per habit.

Render limitation: reminders are processed only while the backend service is
awake and running. If Render sleeps or the service is stopped, due reminders are
not processed until the API runs again. When processing resumes, Level Habit
creates an in-app notification for the due occurrence it sees and schedules the
next future occurrence.

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