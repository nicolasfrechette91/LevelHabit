# Refresh Token Authentication

LevelHabit uses short-lived JWT access tokens plus rotating refresh tokens.
Access tokens remain bearer tokens on API requests. Refresh tokens are sent
only in JSON request bodies to `/api/auth/refresh` and `/api/auth/logout`.

## Backend Behavior

- `POST /api/auth/register` and `POST /api/auth/login` return an access token,
  its expiry, a refresh token, its expiry, and the current user/profile payload.
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
dotnet ef database update
```

Render also needs `Jwt__RefreshTokenExpirationDays` set before or during the
backend release.

## Manual Validation

1. Register or log in and confirm authenticated routes load.
2. Refresh the browser and confirm the session survives while the refresh token
   is valid.
3. Simulate an expired access token if practical and confirm the next API call
   refreshes and retries once.
4. Log out and confirm access token, refresh token, and user-scoped state clear.
5. Log in as user A, load data, log out, log in as user B, and confirm user A
   data does not appear.
