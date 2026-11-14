# ShelterConnect

ShelterConnect is one local system with two runtimes:

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

## Local setup

Use Node 22+ and Python 3.13+.

```sh
cp .env.example .env
cd frontend && pnpm install
cd ../backend && uv sync
```

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
application tables. Both connections enable WAL mode, foreign keys, and a five
second busy timeout. SQLite works well for this local/hackathon topology; move
to PostgreSQL before scaling to multiple app instances or write-heavy traffic.

## Auth model

Public sign-up always receives `driver`; client input cannot select a role.
`shelter_admin` and `super_admin` are assigned only through Better Auth's admin
capability. Set `DEMO_SUPER_ADMIN_EMAIL` before registering that email to create
one local demo administrator. JWTs expire after 15 minutes and contain the
subject and role only; FastAPI validates signature, issuer, audience, expiry,
and role via `/api/auth/jwks`.
