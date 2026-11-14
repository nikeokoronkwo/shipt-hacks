# Hermes

Hermes is one local system with two runtimes:

```text
Browser ── Better Auth session ──► Next.js :3000 (/api/auth/*)
   │                                     │
   └──── Bearer JWT ─────────────────► FastAPI :8000 (/api/*)
                                         │
                    SQLite WAL ◄────────┴────────► SQLite WAL
                         data/shelterconnect.sqlite3
```

The browser reads public shelter data and creates public ride requests directly
from FastAPI. For protected actions, the client asks Better Auth for a short
lived JWT, then sends it as a Bearer token to FastAPI. FastAPI verifies it using
Better Auth's JWKS endpoint; it never reads passwords or session cookies.
Drivers can sign up or sign in with an SMS one-time code, or use email and
password then verify a phone number. FastAPI accepts a driver's phone only from
the signed, phone-verified token. Drivers must opt in to receive new-ride SMS
alerts.

## Local setup

Use Node 22+ and Python 3.13+.

```sh
cp .env.example .env
cd frontend && pnpm install
cd ../backend && uv sync
```

Set `BETTER_AUTH_SECRET` to a random value of at least 32 characters. Generate
one with `openssl rand -base64 32`. Phone OTP and ride alerts require a Twilio
account; set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and
`TWILIO_FROM_NUMBER` in the shared `.env` file.

Run these in separate terminals from the repository root. Each process must
load the same environment file before it starts:

```sh
set -a; source .env; set +a
cd frontend && pnpm auth:migrate && pnpm dev
```

```sh
set -a; source .env; set +a
cd backend && uv run uvicorn main:app --reload --port 8000
```

Open <http://localhost:3000>. The FastAPI startup creates and seeds application
tables; `pnpm auth:migrate` creates Better Auth's own tables.

## One SQLite database, two table owners

Both processes default to `data/shelterconnect.sqlite3`. To relocate it, set the
same file in both environments:

```sh
DATABASE_URL=sqlite:////absolute/path/shelterconnect.sqlite3
DATABASE_FILE=/absolute/path/shelterconnect.sqlite3
```

The boundary is intentional:

| Owner | Tables / responsibility |
| --- | --- |
| Better Auth / Next | `user`, `session`, `account`, `verification`, `jwks`; passwords, sessions, roles, JWT signing |
| SQLAlchemy / FastAPI | `shelters`, `shelter_admins`, `drivers`, `ride_requests`; business data and authorization |

Never run SQLAlchemy migrations against Better Auth tables or use Node to alter
application tables. Both connections enable WAL mode, foreign keys, and a
30-second busy timeout. SQLite works well for this local/hackathon topology; move
to PostgreSQL before scaling to multiple app instances or write-heavy traffic.

## Auth model

Public sign-up always receives `driver`; client input cannot select a role.
Promote trusted users to `shelter_admin` or `super_admin` through Better Auth's
admin capability. Create the first super administrator after running the auth
migration from `frontend/`:

```sh
ADMIN_EMAIL=admin@example.org \
ADMIN_PASSWORD='use-a-strong-unique-password' \
ADMIN_NAME='ShelterConnect Admin' \
pnpm auth:bootstrap-admin
```

This local operator command creates a super administrator through Better
Auth's server API; it is not exposed over HTTP. A super administrator can promote a user with
`authClient.admin.setRole({ userId, role: "shelter_admin" })`; then assign that
Better Auth user to a shelter through the protected
`POST /api/admin/shelter-assignments` endpoint. Never grant admin roles through
public sign-up. JWTs expire after 15 minutes and contain the subject, role, and
verified phone claim; FastAPI validates signature, issuer, audience, expiry,
and role via `/api/auth/jwks`.

## Verification

From the repository root:

```sh
cd backend && uv run python -m unittest discover -s tests -v
cd ../frontend && pnpm lint
```
