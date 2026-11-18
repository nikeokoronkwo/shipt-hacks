# ShelterConnect (Wayfinder)

ShelterConnect helps people experiencing homelessness in Birmingham, AL find a
shelter with open beds and request a ride there from a verified volunteer
driver. The public-facing site is branded **Wayfinder**.

It was built for ShiptHacks. All shelters, bed counts, and rides are demo data;
it is not a live or emergency service.

- [Run the project](#run-the-project)
- [How the website works](#how-the-website-works)
- [Architecture](#architecture)
- [Auth model](#auth-model)
- [Tests and checks](#tests-and-checks)
- [Repository layout](#repository-layout)

## Run the project

The project is two processes that share one SQLite file:

| Process | Folder | URL |
| --- | --- | --- |
| Next.js web app + Better Auth | `frontend/` | <http://localhost:3000> |
| FastAPI application API | `backend/` | <http://localhost:8000> |

### 1. Install the prerequisites

- **Node.js 22+** and **pnpm** (`npm install -g pnpm`)
- **Python 3.13+** and **uv** (<https://docs.astral.sh/uv/getting-started/installation/>)

### 2. Install dependencies

From the repository root:

```sh
cd frontend && pnpm install
cd ../backend && uv sync
```

### 3. Create the environment file

Copy the example file at the repository root:

```sh
cp .env.example .env
```

Then edit `.env`:

| Variable | Required? | What it is for |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | **Yes** | Random value of at least 32 characters. Generate one with `openssl rand -base64 32`. The web app refuses to start without it. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Only for SMS | Phone one-time codes and new-ride text alerts. Without them, everything except phone verification works. |
| Everything else | No | The defaults already point at `localhost:3000` and `localhost:8000`. |

To show the interactive map, also create `frontend/.env.local` with a public
Mapbox token (it must start with `pk.`):

```sh
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your-token
```

Without a token the site still works; map areas show a placeholder.

### 4. Start both processes

Open two terminals at the repository root. Each one must load `.env` before
starting its process.

**macOS, Linux, or Git Bash**

```sh
# Terminal 1: web app
set -a; source .env; set +a
cd frontend && pnpm auth:migrate && pnpm dev
```

```sh
# Terminal 2: API
set -a; source .env; set +a
cd backend && uv run uvicorn main:app --reload --port 8000
```

**Windows PowerShell**

Run this in each terminal to load `.env`:

```powershell
Get-Content .env | Where-Object { $_ -match '^\s*[^#\s][^=]*=' } | ForEach-Object {
  $k, $v = $_ -split '=', 2
  Set-Item "env:$($k.Trim())" $v.Trim()
}
```

Then:

```powershell
# Terminal 1: web app
cd frontend; pnpm auth:migrate; pnpm dev
```

```powershell
# Terminal 2: API
cd backend; uv run uvicorn main:app --reload --port 8000
```

`pnpm auth:migrate` creates the sign-in tables and only needs to run once (it
is safe to repeat). The API creates its own tables and seeds three demo
shelters the first time it starts. The database is written to
`data/shelterconnect.sqlite3`; delete the `data/` folder to start over.

### 5. Open the site

- <http://localhost:3000>: the Wayfinder site
- <http://localhost:3000/access>: the live service portal (real sign-in and ride requests)
- <http://localhost:8000/docs>: interactive API documentation
- <http://localhost:8000/health>: API health check

### 6. Create an administrator (optional)

A super administrator is needed to verify drivers and assign shelter admins.
With `.env` loaded, from `frontend/`:

```sh
ADMIN_EMAIL=admin@example.org \
ADMIN_PASSWORD='use-a-strong-unique-password' \
ADMIN_NAME='ShelterConnect Admin' \
pnpm auth:bootstrap-admin
```

In PowerShell, set the three values with `$env:ADMIN_EMAIL = "..."` and so on,
then run `pnpm auth:bootstrap-admin`. Passwords must be at least 12 characters.

## How the website works

Shelter search, pickup requests, ride tracking, and driver pages connect to
FastAPI and Better Auth. Driver signup and sign-in save real local accounts
and profiles. Shelter registration and feedback remain design previews.

### Pages

| Page | Route | What it does |
| --- | --- | --- |
| Home | `/` | Search by neighborhood, quick filters, how-it-works, FAQ. |
| Find shelter | `/find-shelter` | Search, filter (pet friendly, ADA accessible, women only, family units), sort by distance or beds, list and map views. |
| Shelter details | `/shelter-details/[id]` | Intake hours, who it serves, bed count, map, and a demo ride request form. |
| Track ride | `/track-ride` | Shows the demo ride's status. A button steps through the statuses by hand. |
| Become a driver | `/become-a-driver` | Live account creation and resumable phone/vehicle profile setup. |
| Driver dashboard | `/driver-profile` | Live profile, availability, SMS preferences, and ride requests. |
| Driver request | `/driver/requests/123` | Preview of accepting, starting, and completing a ride. |
| Register a shelter | `/shelter-registration` | Preview of the shelter onboarding form. |
| Feedback | `/submit-feedback` | Preview of the feedback form. |
| Emergency contacts | `/emergency-contacts` | Real phone numbers: 911, 211, and 988. |
| Service portal | `/access` | Live shelter list, live ride requests, driver sign-up and sign-in. |

### For someone who needs shelter

No account is needed.

**In the preview** (try the full experience):

1. On the home page, type a neighborhood or pick a filter.
2. On **Find shelter**, choose a shelter from the list or the map.
3. On the shelter page, select **Try a demo ride request** and fill in the form.
4. You land on **Track ride**, where the ride moves through
   Pending → Accepted → In progress → Completed.

**In the service portal** (a real request saved to the database):

1. Open `/access`. The shelter cards show bed counts from the API.
2. Fill in the **Transportation request** form: name, pickup location, shelter.
3. You receive a request number and a **private tracking token**. Save it; it
   is shown only once and is the only way to look the ride up later
   (`GET /api/rides/{id}` with the token in the `X-Tracking-Token` header).
4. Verified drivers who are online and opted in to texts get an SMS alert.

A request is refused if the shelter reports no available beds. An available
bed is not a reservation or a guarantee of admission.

### For a volunteer driver

1. Follow **Sign up to drive** to `/become-a-driver`. Create an email/password
   account (12+ characters), or use **Phone by SMS** to verify a phone and sign
   in. SMS codes expire after five minutes and require working Twilio settings.
2. Add your phone number and vehicle make, model, color, and license plate.
   Choose whether to receive new-ride SMS alerts; they default off.
3. Save the profile and open `/driver-profile`. The current local demo
   automatically verifies registered drivers and starts them offline. Email
   registration does not require SMS delivery.
4. Set yourself online when ready. Update SMS consent from the dashboard;
   preferences work for email accounts and preserve the registered phone.

If profile setup fails after account creation, the account remains saved.
Retry **Save driver profile**, or sign in at `/access` and follow **Driver
account setup** from the dashboard. Revisiting signup resumes an incomplete
account or recognizes an existing profile without resetting its SMS consent.

Signup previously retried account creation after a backend failure, leaving
users stuck with an already-registered email. The setup steps now use the
active session and distinguish a missing profile from an unavailable API.
SMS delivery errors are also returned to the browser instead of claiming a
code was sent before delivery completed.

Both services must load the same root `.env`. Files in the old `auth/`
directory are not loaded by Next.js. Keep `BETTER_AUTH_URL`, `AUTH_ISSUER`,
`AUTH_JWKS_URL`, browser auth URL, and CORS origins aligned on port 3000.
Missing or rejected Twilio credentials prevent SMS sign-in; email registration
remains available. Profile verification here is the existing local-demo policy,
not an identity or background check.

### For shelter staff and administrators

There are no admin screens yet; these actions go through the API.

- A **shelter admin** can update bed counts, meals, and services for the
  shelters they are assigned to (`PATCH /api/shelters/{id}`).
- A **super admin** can update any shelter, assign shelter admins
  (`POST /api/admin/shelter-assignments`), and verify drivers.

## Architecture

```text
Browser ── Better Auth session ──► Next.js :3000 (/api/auth/*)
   │                                     │
   └──── Bearer JWT ─────────────────► FastAPI :8000 (/api/*)
                                         │
                    SQLite WAL ◄────────┴────────► SQLite WAL
                         data/shelterconnect.sqlite3
```

The browser reads public shelter data and creates public ride requests directly
from FastAPI. For protected actions, the client asks Better Auth for a
short-lived JWT, then sends it as a Bearer token to FastAPI. FastAPI verifies it
using Better Auth's JWKS endpoint; it never reads passwords or session cookies.
FastAPI derives the driver identity from the signed token. Local-demo registration
accepts phone and vehicle details in the profile request; SMS-only sign-in still
requires phone verification.

### One SQLite database, two table owners

Both processes default to `data/shelterconnect.sqlite3`. To relocate it, set the
same file in both environments:

```sh
DATABASE_URL=sqlite:////absolute/path/shelterconnect.sqlite3
DATABASE_FILE=/absolute/path/shelterconnect.sqlite3
```

| Owner | Tables / responsibility |
| --- | --- |
| Better Auth / Next | `user`, `session`, `account`, `verification`, `jwks`; passwords, sessions, roles, JWT signing |
| SQLAlchemy / FastAPI | `shelters`, `shelter_admins`, `drivers`, `ride_requests`; business data and authorization |

Never run SQLAlchemy migrations against Better Auth tables or use Node to alter
application tables. Both connections enable WAL mode, foreign keys, and a
30-second busy timeout. SQLite works well for this local/hackathon topology; move
to PostgreSQL before scaling to multiple app instances or write-heavy traffic.

## Auth model

There are three roles: `driver`, `shelter_admin`, and `super_admin`.

Public sign-up always receives `driver`; client input cannot select a role.
Create the first super administrator with `pnpm auth:bootstrap-admin`
([step 6](#6-create-an-administrator-optional)). That command runs locally
through Better Auth's server API and is not exposed over HTTP.

A super administrator can promote a user with
`authClient.admin.setRole({ userId, role: "shelter_admin" })`, then assign that
user to a shelter through `POST /api/admin/shelter-assignments`. Never grant
admin roles through public sign-up.

JWTs expire after 15 minutes and contain the subject, role, and verified phone
claim. FastAPI validates signature, issuer, audience, expiry, and role via
`/api/auth/jwks`.

## Tests and checks

```sh
cd backend && uv run python -m unittest tests.test_auth tests.test_database tests.test_driver_signup -v
cd ../frontend && pnpm lint && pnpm typecheck
```

Three legacy test modules (`test_driver_collection.py`,
`test_driver_workflow.py`, and `test_shelters.py`) and the scripts in
`backend/scripts/` import an older `app.*` package layout (`app.main`, `app.database`,
`app.models`) that is not in the repository, so they do not currently run. The
running API is `backend/main.py` with the `shiptohome` package in
`backend/src/`.

Run the repeatable full-stack browser checks from `frontend/`:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

Stop other services on ports 3000 and 8000 first. Playwright migrates a
fresh temporary SQLite database and starts real Next.js/Better Auth and
FastAPI services with aligned JWT/JWKS/CORS settings. It tests signup,
profile retry/resume, consent and vehicle persistence, SMS verification and
delivery failures, shelter selection, pickup forms, and navigation. Only SMS
transport is replaced in the test server; no real SMS or developer database
is used. OTP captures are removed at teardown.

## Repository layout

| Path | Contents |
| --- | --- |
| `frontend/` | Next.js 16 app: pages in `app/`, UI in `components/`, Better Auth setup in `lib/auth.ts`, API client in `lib/api.ts`, sample data in `lib/demo-data.ts` |
| `backend/main.py` | FastAPI routes |
| `backend/src/shiptohome/` | Models, schemas, JWT verification, database setup, seed data, SMS |
| `backend/app/` | Earlier draft of the API modules; not used by `main.py` |
| `specs/` | Product and technical specs |
| `wayfinder-2/` | Original static HTML designs the frontend was built from |
| `local/` | Postman collection and environment for the driver workflow |
| `data/` | SQLite database, created on first run (git-ignored) |
