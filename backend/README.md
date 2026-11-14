# ShelterConnect backend

From `backend/`:

```sh
uv sync
cp .env.example .env
uv run uvicorn app.main:app --reload --env-file .env
```

Open http://127.0.0.1:8000/docs. `GET /health` checks SQLite; `GET /api/me` requires a Better Auth Bearer JWT and returns `{ "id": "...", "role": "driver" }`.

`app.database` exposes `Base`, `engine`, `SessionLocal`, and `get_db`. Startup creates missing application tables from `app.models`: `shelters`, `shelter_admins`, `drivers`, `cars`, and `ride_requests`, with the constraints and indexes in `../specs/database-spec.md`. Better Auth manages its own auth tables separately; domain endpoints are not yet implemented.

Each driver can register at most one car. `cars` stores required make, model, color, and license plate strings, with a unique foreign key to `drivers.id`.

To create the tables without starting the server:

```sh
uv run python -c 'from app.database import init_db; init_db()'
```

Creation is idempotent but does not migrate existing tables when their schema changes. Timestamps are stored as UTC ISO 8601 text; SQLAlchemy supplies creation timestamps and refreshes shelter `updated_at` on updates. Raw SQL writers must supply/refresh timestamps themselves. Services are stored as JSON text; validate the array shape at the application boundary.

Run the SQLite schema tests:

```sh
uv run python -m unittest discover -s tests -v
```
Start the separate auth service using [its setup instructions](../auth/README.md). The defaults use one SQLite file: `backend/shelterconnect.db`. If changing paths, configure `DATABASE_URL` and `AUTH_DB_PATH` explicitly to reference the same file. SQLAlchemy owns application tables; Better Auth owns auth tables.

## Shared authentication contract

```python
from fastapi import Depends
from app.auth.dependencies import CurrentUser, get_current_user, require_role

# Any authenticated role:
# user: CurrentUser = Depends(get_current_user)

# Exact role check:
# user: CurrentUser = Depends(require_role("driver"))

# Explicitly allow either administrator role:
# user: CurrentUser = Depends(require_role("shelter_admin", "super_admin"))
```

`CurrentUser.id` is the verified Better Auth user ID. FastAPI verifies ES256 signatures, issuer, audience, expiration, subject, and supported role. JWKS is cached for five minutes with a 30-second cooldown on refresh for unknown key IDs. Invalid/missing authentication returns 401 with a Bearer challenge; insufficient role returns 403. There is no implicit role hierarchy. Resource assignment and driver eligibility checks belong in their respective endpoints.

Configure `AUTH_ISSUER`, `AUTH_JWKS_URL`, `AUTH_AUDIENCE`, and `CORS_ORIGINS` in `.env`. FastAPI does not accept Better Auth session cookies in place of JWTs. Existing tokens remain valid for up to 15 minutes after role changes or logout.

## Verification

```sh
uv run pytest tests -q
uv run python tests/smoke_auth.py
```

The smoke test requires `npm ci` in `auth/`. It uses a temporary database and local ports 13001/18000, creates disposable credentials, starts both services, verifies signup escalation is blocked, validates real JWTs through FastAPI, restarts auth to verify persistent sessions/signing keys, checks login/logout and protected administrator operations, and stops its processes afterward.
