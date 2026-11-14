# ShelterConnect backend (starter)

From `backend/`:

```sh
uv sync
uv run uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000/docs or check `GET /health`. The server creates `shelterconnect.db` in the working directory on startup. Set `DATABASE_URL` to a SQLite URL (for example, `sqlite:///./other.db`) to use another file.

`app.database` exposes `Base`, `engine`, `SessionLocal`, and `get_db` for future models/routes. No application tables, auth, or domain endpoints have been added yet. Better Auth will manage its own auth tables separately.
