# Hermes web app

This Next.js app hosts the Better Auth API at `/api/auth/*` and provides the
public shelter, ride-request, and driver sign-in UI. FastAPI owns business
operations; both processes share the SQLite file configured in the root
`.env`.

For setup, migrations, Twilio configuration, user roles, and running both
processes, see the repository [README](../README.md).

From the repository root, load the shared environment before starting Next.js:

```sh
set -a; source .env; set +a
cd frontend && pnpm dev
```
