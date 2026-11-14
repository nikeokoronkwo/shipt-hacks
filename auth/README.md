# ShelterConnect authentication

Requires Node 22.13+ and npm. Run from `auth/`:

```sh
npm ci
cp .env.example .env
```

Replace `BETTER_AUTH_SECRET` with a random secret of at least 32 characters (for example, generate one with `openssl rand -hex 32`). Keep it stable across restarts; it protects sessions and signing keys. Configure `TRUSTED_ORIGINS` with exact frontend origins.

```sh
npm run migrate
npm run dev
```

The auth service listens on localhost:3001. Better Auth owns and migrates its tables. `AUTH_DB_PATH` resolves from the auth process's working directory; the default explicitly points to the backend's SQLite file. Both services enable foreign keys, WAL, and a 30-second busy timeout.

Create the initial super administrator locally using operator-supplied credentials:

```sh
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='choose-a-strong-password' npm run bootstrap-admin
```

This command uses Better Auth's server API. Re-running for an existing email fails rather than resetting credentials. There are no seeded passwords or automatic administrator promotions. Signed-in super administrators can create shelter administrators or assign roles through Better Auth's Admin plugin. Drivers and shelter administrators receive no user-management permissions.

## HTTP flow

All auth routes start with `/api/auth`. Use the official Better Auth client or retain the session cookie between requests:

1. `POST /sign-up/email` with `{ "name": "Ben", "email": "ben@example.com", "password": "your-password" }` creates a driver. A caller-supplied role cannot grant privileges.
2. `POST /sign-in/email` with email and password logs in.
3. `GET /get-session` retrieves the current session.
4. `GET /token` returns `{ "token": "..." }` for an authenticated session.
5. Send `Authorization: Bearer <token>` to FastAPI's `GET /api/me`.
6. `POST /sign-out` with `{}` ends the session.

Browser requests to the auth service must include credentials. The service allows only configured browser origins. State-changing requests use Better Auth's origin/CSRF validation. JWTs use ES256, a 15-minute lifetime, the auth base URL as issuer, and `shelterconnect-api` as audience. Public keys are at `/api/auth/jwks`.

Logout ends the session and prevents new JWT issuance. Already issued JWTs remain usable until expiry; role changes likewise take effect in FastAPI when a fresh token is issued or the old token expires.

```sh
npm run check
```

See `backend/README.md` for FastAPI setup and the full smoke test.
