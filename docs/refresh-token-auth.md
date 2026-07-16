# Refresh Token Authentication

LevelHabit uses short-lived JWT access tokens plus rotating refresh tokens.
Access tokens are held only in Angular memory and remain bearer tokens on
protected API requests. Refresh tokens are held in an API-origin cookie and are
never returned to frontend JavaScript.

## Browser transport

- `POST /api/auth/login` returns the access token and user/profile data. It sets
  the refresh token in an `HttpOnly` cookie.
- `GET /api/auth/csrf` returns a one-time double-submit value and sets the
  matching value in a separate `HttpOnly` cookie.
- `POST /api/auth/refresh` reads the refresh token from its cookie and requires
  the CSRF value in both the CSRF cookie and `X-LevelHabit-CSRF` header.
- `POST /api/auth/logout` uses the same CSRF defense, revokes the current refresh
  token, and expires both authentication cookies.
- Angular sends `withCredentials: true` for login, CSRF, refresh, and logout.
- Access and refresh tokens are not stored in local storage or session storage.
  Startup removes the obsolete `levelhabit.auth.v1` object from either store.

The production frontend and API are cross-site. Production cookies therefore
use `Secure`, `HttpOnly`, and `SameSite=None`. Localhost development uses
`Secure=false` and `SameSite=Lax` because both applications run over HTTP on the
same site with different ports.

## CSRF defense

Credentialed cross-site cookies introduce CSRF risk. LevelHabit uses a
double-submit token for refresh and logout:

1. Angular requests `/api/auth/csrf` with credentials.
2. The API creates a cryptographically random token, returns it in JSON, and
   writes the same value to an `HttpOnly` cookie.
3. Angular holds the returned value only long enough to send it in the
   `X-LevelHabit-CSRF` request header.
4. The API compares the cookie and header in fixed time before reading or
   revoking the refresh token.

An unrelated origin cannot read the CSRF response because CORS allows only
explicit frontend origins. JSON authentication requests also require a CORS
preflight. Credentialed CORS never uses a wildcard origin.

## Backend behavior

- Login is available only after email confirmation.
- Refresh tokens are cryptographically random; only SHA-256 hashes are stored
  in PostgreSQL.
- Refresh rotates the token, revokes the token that was used, and links it to
  the replacement hash.
- Reusing an expired, revoked, or rotated refresh token returns `401`.
- Logout revokes the current token and expires the cookies.
- `/api/auth/me` and all application APIs still require a JWT bearer access
  token.

## Configuration

Production/Render:

```text
Jwt__ExpirationMinutes=15
Jwt__RefreshTokenExpirationDays=30
Jwt__Secret=<at least 32 random characters>
Jwt__Issuer=LevelHabit.Api
Jwt__Audience=LevelHabit.Frontend
AuthCookies__RefreshTokenName=LevelHabit.Refresh
AuthCookies__CsrfTokenName=LevelHabit.Csrf
AuthCookies__Secure=true
AuthCookies__SameSite=None
Cors__AllowedOrigins__0=https://nicolasfrechette91.github.io
```

The checked-in Development settings use the `.Development` cookie names,
`Secure=false`, `SameSite=Lax`, and the explicit `http://localhost:4200`
origin. Do not use those cookie flags or the localhost origin in production.

## Deployment order

Deploy the backend before the frontend. The old frontend expects refresh tokens
in JSON, while the new backend intentionally omits them. After both artifacts
are deployed, existing local-storage sessions are removed and users sign in
once to establish the new cookie session. No database migration is required.

Cross-site cookies can be blocked by strict third-party-cookie browser or
enterprise policies. A same-site custom API domain is the most robust future
deployment if those policies must be supported.

## Verification

1. Log in and confirm the JSON response has no refresh-token properties.
2. Confirm `levelhabit.auth.v1` is absent from local and session storage.
3. Confirm the refresh cookie is `HttpOnly`, `Secure`, and `SameSite=None` in
   production.
4. Reload an authenticated route and confirm cookie refresh restores the page.
5. Expire/reject an access token and confirm one refresh and one request retry.
6. Log out and confirm the refresh cookie is removed and reload stays logged
   out.
7. Confirm an old rotated refresh token is rejected.
8. Confirm GitHub Pages and localhost credentialed preflights use their exact
   allowed origins.
