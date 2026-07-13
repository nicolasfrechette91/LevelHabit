# Refresh Token Authentication

LevelHabit uses short-lived JWT access tokens plus rotating refresh tokens.
Access tokens remain bearer tokens on API requests. Refresh tokens are sent
only in JSON request bodies to `/api/auth/refresh` and `/api/auth/logout`.

## Backend Behavior

- `POST /api/auth/register` creates an unconfirmed account, creates the hero
  profile, sends a six-digit email verification code, and returns a
  verification-required message without issuing tokens.
- `POST /api/auth/confirm-email` confirms the account when the six-digit code
  is valid and unexpired.
- `POST /api/auth/login` returns an access token, its expiry, a refresh token,
  its expiry, and the current user/profile payload only after the user's email
  has been confirmed.
- `POST /api/auth/refresh` validates the refresh token, rejects unknown,
  expired, or revoked tokens with `401`, revokes the token that was used, and
  returns a new access token and a new refresh token.
- Reusing a rotated refresh token does not grant access.
- `POST /api/auth/logout` revokes the submitted refresh token when it is known.
- `/api/auth/me` remains protected by the JWT bearer access token.

Refresh tokens are cryptographically random. The API stores only SHA-256 hashes
in the `refresh_tokens` table, never plaintext tokens.

## Frontend Storage Tradeoff

The production frontend is hosted on GitHub Pages and the API is hosted on
Render. Because those are different sites, httpOnly cross-site cookies would
require credentialed CORS, `SameSite=None; Secure`, and would still be affected
by third-party cookie restrictions in some browsers.

For this deployment, the Angular app stores the access token and refresh token
in `localStorage`, matching the existing token approach. This is simple and
works across browser refreshes, but it means XSS would be able to read tokens.
Tokens are never placed in query strings, and logout, failed refresh, and user
switches clear local auth and user-scoped state.

## Configuration

Backend configuration keys:

```text
Jwt__ExpirationMinutes=15
Jwt__RefreshTokenExpirationDays=30
Jwt__Secret=<at least 32 random characters>
Jwt__Issuer=LevelHabit.Api
Jwt__Audience=LevelHabit.Frontend
```

`Jwt__ExpirationMinutes` controls access-token lifetime.
`Jwt__RefreshTokenExpirationDays` controls refresh-token lifetime.

Email verification configuration keys:

```text
EmailVerification__CodeExpirationMinutes=10
EmailVerification__ResendCooldownSeconds=60
EmailVerification__MaximumFailedAttempts=5
BREVO_API_KEY=<Brevo transactional email API key>
BREVO_SENDER_EMAIL=<verified sender email>
BREVO_SENDER_NAME=LevelHabit
```

## Local Migration Steps

```powershell
docker compose up -d
cd backend\LevelHabit.Api
dotnet ef database update
```

## Production Migration Steps

Apply the EF migration to Supabase before deploying the backend that depends on
refresh tokens:

```powershell
cd backend\LevelHabit.Api
$env:ConnectionStrings__DefaultConnection = "<Supabase PostgreSQL connection string>"
$env:Jwt__Secret = "replace-with-at-least-32-random-characters"
$env:Frontend__BaseUrl = "https://nicolasfrechette91.github.io/LevelHabit"
$env:Email__Provider = "Brevo"
$env:BREVO_API_KEY = "<Brevo transactional email API key>"
$env:BREVO_SENDER_EMAIL = "<verified sender email>"
$env:BREVO_SENDER_NAME = "LevelHabit"
dotnet ef database update
```

Render also needs the JWT, Brevo, frontend URL, and email verification settings
set before or during the backend release.

## Manual Validation

1. Register a new account and confirm no tokens are issued before email
   confirmation.
2. Confirm the email with the six-digit code, then log in and confirm
   authenticated routes load.
3. Refresh the browser and confirm the session survives while the refresh token
   is valid.
4. Simulate an expired access token if practical and confirm the next API call
   refreshes and retries once.
5. Log out and confirm access token, refresh token, and user-scoped state clear.
6. Log in as user A, load data, log out, log in as user B, and confirm user A
   data does not appear.
