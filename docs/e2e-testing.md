# End-to-End Testing

LevelHabit uses Playwright for a small local E2E suite that drives the real
Angular app against the local ASP.NET Core API and local PostgreSQL database.
The tests generate unique users and habit names at runtime and do not require
production credentials.

The non-destructive QA remediation suite uses a contract-faithful mocked API
and runs in Chromium, Firefox, and WebKit. The older destructive lifecycle and
user-isolation cases remain Chromium-only to limit generated local data. The
separate `playwright.production.config.ts` suite is excluded from this local
configuration and requires authorized production credentials.

Run the production-only matrix from `frontend` with:

```powershell
npm run test:e2e:production
```

The command requires `LEVELHABIT_BASE_URL`, `LEVELHABIT_TEST_EMAIL`, and
`LEVELHABIT_TEST_PASSWORD`, fails before browser startup if any are missing,
and accepts only the production GitHub Pages LevelHabit URL. It never starts
the local Angular web server. Do not print or persist the password value.

## Covered Flows

- Main user journey: register, reach the dashboard, create a habit, complete it,
  verify XP/streak/achievement/analytics feedback, log out, log back in, and
  confirm persisted progress.
- User isolation: complete a habit as User A, register User B, and confirm User
  B does not see User A's habit, analytics progress, or achievement unlocks.
- QA remediation: anonymous-only routes, login single-flight, create/edit
  length validation, cookie-session restoration/storage, and notification
  dialog focus in all three browser engines.

## Prerequisites

- Docker Desktop or another Docker Compose compatible runtime.
- PostgreSQL running from the repository Docker Compose file.
- Local backend secrets configured for `ConnectionStrings:DefaultConnection`
  and `Jwt:Secret`.
- EF Core migrations applied to the local database.
- Playwright browser binaries installed once with `npm run e2e:install`.

## Local Setup

From the repository root:

```powershell
docker compose up -d
```

Backend:

```powershell
cd backend\LevelHabit.Api
dotnet ef database update
dotnet run --launch-profile http
```

Frontend dependencies and Playwright browsers:

```powershell
cd frontend
npm install
npm run e2e:install
```

Run E2E tests from `frontend`:

```powershell
npm run e2e
```

Playwright starts the Angular dev server automatically at
`http://localhost:4200` and reuses it if it is already running. The backend API
must be available at `http://localhost:5118/api`; each test waits for
`/api/health` before driving the browser.

To open the Playwright UI:

```powershell
npm run e2e:ui
```

## Optional Environment Variables

- `E2E_BASE_URL`: frontend URL. Default: `http://localhost:4200`.
- `E2E_API_URL`: API base URL. Default: `http://localhost:5118/api`.
- `E2E_SKIP_WEB_SERVER=1`: do not auto-start Angular; use an already running
  frontend server.

Example:

```powershell
$env:E2E_SKIP_WEB_SERVER = "1"
npm run e2e
Remove-Item Env:E2E_SKIP_WEB_SERVER
```

## CI Status

The E2E suite is intentionally local/manual for now. It is not part of the
required GitHub Actions validation workflow because it depends on full-stack
startup, Docker PostgreSQL, backend secrets, and migrations.

The original lifecycle helpers predate mandatory email verification. Running
those two destructive cases against a real local API also requires a practical
way for the test operator to obtain and enter the Development email code. The
mocked QA remediation suite does not bypass application email verification.
