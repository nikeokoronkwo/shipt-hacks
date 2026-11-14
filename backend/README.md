# ShelterConnect API

FastAPI owns shelters, driver profiles, and transportation requests. It does
not store passwords, sessions, or Better Auth users. The active auth contract
and shared SQLite table ownership are documented in the repository
[README](../README.md).

From the repository root, load the shared environment in each terminal.

Terminal 1 — migrate Better Auth's tables and start Next.js:

```sh
set -a; source .env; set +a
cd frontend && pnpm auth:migrate && pnpm dev
```

Terminal 2 — start the API:

```sh
set -a; source .env; set +a
cd backend && uv run uvicorn main:app --reload --port 8000
```

FastAPI creates only application tables and seeds the fictional Birmingham
shelters on first launch. Better Auth owns the auth tables and their migrations.
Never alter those tables through SQLAlchemy.

Driver identity and phone numbers come from the signed Better Auth JWT. Driver
profile initialization requires a verified phone claim, a vehicle, and an
explicit SMS-alert choice. Changing the verified phone turns off availability
and resets SMS consent for the new number; alert delivery also checks Better
Auth's current verified phone before sending. Pending ride listings expose
only a coarse pickup area; `/api/drivers/me/active-ride` returns full details
for that driver's assigned ride. A driver can add or update one vehicle with
`PATCH /api/drivers/me/vehicle`. Vehicle details are returned only in the
driver's own profile, and drivers need one before going online.

For a disposable local demo only, use the guarded operator script to verify a
driver without adding an HTTP verification route:

```sh
cd backend
set -a; source ../.env; set +a
SHELTERCONNECT_DEMO_MODE=1 uv run python scripts/verify_demo_driver.py <auth-user-id> --demo
```

Run the backend JWT and SQLite checks from `backend/`:

```sh
uv run python -m unittest discover -s tests -v
```
