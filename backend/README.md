# Hermes API

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

Run the backend JWT and SQLite checks from `backend/`:

```sh
uv run python -m unittest discover -s tests -v
```
