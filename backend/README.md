## ShelterConnect API

This service owns shelters, driver profiles, and transportation requests. It
does **not** store passwords, sessions, or Better Auth users.

### Run locally

From the repository root, first migrate Better Auth's tables, then run this
API:

```sh
cd frontend && pnpm auth:migrate
cd ../backend && uv run uvicorn main:app --reload --port 8000
```

The API seeds fictional Birmingham shelters on first launch. Its default
database is `../data/shelterconnect.sqlite3`, the same file used by the Next
application. Set an absolute `DATABASE_URL` to relocate it for deployment.

FastAPI creates only application tables. Better Auth owns and migrates `user`,
`session`, `account`, `verification`, and `jwks`; never create or alter those
from Python.
