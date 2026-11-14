# ShelterConnect backend (starter)

From `backend/`:

```sh
uv sync
uv run uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000/docs or check `GET /health`. The server creates `shelterconnect.db` in the working directory on startup. Set `DATABASE_URL` to a SQLite URL (for example, `sqlite:///./other.db`) to use another file.

`app.database` exposes `Base`, `engine`, `SessionLocal`, and `get_db`. Startup creates missing application tables from `app.models`: `shelters`, `shelter_admins`, `drivers`, `cars`, and `ride_requests`, with the constraints and indexes in `../specs/database-spec.md`. Better Auth manages its own auth tables separately; no auth or domain endpoints have been added.

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
