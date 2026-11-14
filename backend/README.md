# ShelterConnect backend

From `backend/`:

```sh
uv sync
cp .env.example .env
uv run uvicorn app.main:app --reload --env-file .env
```

Open http://127.0.0.1:8000/docs. `GET /health` checks SQLite; `GET /api/me` requires a Better Auth Bearer JWT and returns `{ "id": "...", "role": "driver" }`.

`app.database` exposes `Base`, `engine`, `SessionLocal`, and `get_db`. Startup creates missing application tables from `app.models`: `shelters`, `shelter_admins`, `drivers`, `cars`, and `ride_requests`, with the constraints and indexes in `../specs/database-spec.md`. Better Auth manages its own auth tables separately. Shelter management, driver workflows, and anonymous ride creation are implemented below. Private ride-status lookup is not yet implemented.

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

## Driver workflow

All routes below require a Better Auth Bearer JWT with the exact `driver` role.
Identity always comes from the verified JWT, never a request-body user/driver ID.
Request validation and response models live in `app/driver_schemas.py`, business
rules and serialized SQLite transactions in `app/driver_service.py`, and thin
HTTP handlers in `app/drivers.py`. The runtime OpenAPI contract is available at
`/openapi.json` and interactive documentation at `/docs`.

| Method | Route | Body / result |
| --- | --- | --- |
| POST | `/api/drivers/me/initialize` | Phone plus required `vehicle` (example below); idempotently returns profile and vehicle (200) |
| GET | `/api/drivers/me` | Current profile |
| PATCH | `/api/drivers/me` | `{ "phone_number": "2055550123" }` |
| PATCH | `/api/drivers/me/availability` | `{ "is_available": true }`; verification required to go online |
| GET | `/api/drivers/requests` | Pending requests for verified, online drivers; poll every 3–5 seconds |
| GET | `/api/drivers/me/active-ride` | Own active ride, or `null`; supports dashboard reloads |
| POST | `/api/rides/{ride_id}/accept` | No body; assigns the authenticated driver |
| PATCH | `/api/rides/{ride_id}/status` | `{ "status": "IN_PROGRESS" }`, `COMPLETED`, or `CANCELLED` |

Phone numbers must be nonblank strings; leading zeros and punctuation are
preserved. Extra profile/availability/status input fields are rejected (422),
including attempts to set verification or identity. Missing/invalid JWTs return
401; wrong roles, ineligible drivers, and assignment-ownership violations return
403. Missing profiles/rides return 404. Acceptance conflicts and invalid status
transitions return 409. Initialization retries do not overwrite existing data.

New profiles now default to **verified/offline** for the hackathon, overriding
the original work spec's unverified default. Existing profiles keep their current
verification. This is demo behavior, not a production driver-screening process.
There is **no public verification endpoint**. For an existing unverified profile
in a disposable local demo database, run this with its `auth_user_id` if needed
(load `.env` first):

```sh
PYTHONPATH=. uv run python scripts/verify_demo_driver.py <auth_user_id> --demo
```

New drivers can go online immediately after initialization. The CLI does not
change availability or enable SMS. No driver endpoint accepts a caller-supplied
verification status.

Account registration/login remain owned by Better Auth. After obtaining a JWT,
complete driver signup by registering the driver profile **and vehicle** together:

```json
{
  "phone_number": "2055550100",
  "vehicle": {
    "make": "Toyota",
    "model": "Camry",
    "color": "Blue",
    "license_plate": "001-ABC"
  }
}
```

All vehicle fields are required nonblank strings. Profile and vehicle creation
share a transaction; the existing `cars.driver_id` unique constraint enforces
one vehicle per driver. Retries preserve an existing profile and vehicle. An
older profile without a vehicle can register one using this same endpoint.
Profile responses include a nested `vehicle` (or `null` for legacy profiles
without one); pending listings do not expose plates or vehicle data. Phone-only
updates still use `PATCH /api/drivers/me`. Existing SQLite tables need no schema
migration for vehicles. The ORM supplies the verified default even against older
tables whose SQL default remains unverified. Going offline does not cancel an active
ride or prevent its assigned driver from completing it.

Pending responses expose no names, street addresses, precise coordinates, or
tracking tokens/hashes. Coordinate pickups are represented by a coarse 0.1-degree
cell. **Limitation:** no geocoder currently exists for free-form addresses, so
address-only requests use a generic pickup label until assignment rather than
risk leaking a precise address. Full pickup details become available only after
assignment and through the assigned driver's active-ride lookup.

Acceptance uses `BEGIN IMMEDIATE` before eligibility/active-ride checks and a
conditional SQL update, backed by the existing unique active-ride index. Status
updates are serialized too. Driver transitions are `ACCEPTED → IN_PROGRESS`,
`ACCEPTED → CANCELLED`, and `IN_PROGRESS → COMPLETED`. Cancellation/completion
release the active-ride slot. Pending cancellation belongs to the separate seeker
workflow. Reported shelter capacity is not a reservation or confirmed admission;
the frontend must communicate that limitation.

Import `../local/ShelterConnect-driver-workflow.postman_collection.json` into
Postman. Configure `base_url` (backend), `auth_base_url` (default
`http://localhost:3001`), `auth_origin` (a configured trusted origin), `name`,
`email`, and `password` locally, preferably using a private Postman environment.
Start the auth service using `../auth/README.md`. Keep Postman's cookie jar enabled.
Run **Register driver account** for a new user or **Login** for an existing user,
then **Get driver JWT**. That request saves `driver_token` automatically as a
collection variable; remove any environment-level `driver_token` override.
Fill `vehicle_make`, `vehicle_model`, `vehicle_color`, and
`vehicle_license_plate`, then run **Register driver profile and vehicle**.
New profiles are verified automatically; continue with **Go online**. JWTs expire after 15 minutes; rerun the JWT request while the session
is active. Do not sync/export populated passwords or tokens, or save them in Git.
Use **Create ride request** to create a pending ride before polling/accepting.
Private tracking lookup and SMS integration are not implemented. No shelter
model/schema changes are required.

## Anonymous ride requests

`POST /api/rides` needs no authentication. The normal frontend flow asks for
location permission and sends numeric latitude/longitude, **not an address**:

```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "pickup_latitude": 33.5207,
  "pickup_longitude": -86.8025,
  "shelter_id": 1
}
```

The browser (not the backend or Postman) owns the permission prompt. On the
frontend's request-ride button, use the following pattern, passing the API URL,
requester names, and selected shelter ID from the form:

```js
async function requestRide(baseUrl, firstName, lastName, shelterId) {
  if (!navigator.geolocation) throw new Error("Geolocation is not supported");
  const { coords } = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
  const response = await fetch(`${baseUrl}/api/rides`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      pickup_latitude: coords.latitude,
      pickup_longitude: coords.longitude,
      shelter_id: shelterId,
    }),
  });
  if (!response.ok) throw new Error(`Ride request failed (${response.status})`);
  return response.json(); // Keep the returned tracking token private.
}
```

Call this from a user action on HTTPS or localhost. Show permission-denied,
unavailable-location, timeout, and API errors in the UI; never submit made-up
coordinates when permission fails. This is integration guidance; this backend
checkout has no frontend UI implementation yet. An optional address-only fallback
is supported by the API, but is not required for geolocation requests.

Names must be nonblank strings. Coordinates must be a complete pair in range
(latitude -90..90, longitude -180..180); `(0, 0)` is valid. Unknown fields,
client-supplied assignment/status, and missing pickup data return 422. An unknown
shelter returns 404; a shelter reporting no available beds returns 409.

Success returns **201** with `{ "id": ..., "status": "PENDING",
"tracking_token": "..." }` and `Cache-Control: no-store`. Only a SHA-256 hash of
the random 256-bit token is stored. The plaintext token is returned only once;
there is not yet a private tracking lookup endpoint. Creation leaves beds
unchanged: reported capacity does **not** guarantee a reservation or admission.
Repeated successful POSTs create distinct requests. No SMS is sent.

Reimport the collection and environment from `../local/`. Set `shelter_id` to an
existing shelter with beds, plus `rider_first_name`, `rider_last_name`,
`pickup_latitude`, and `pickup_longitude`. Postman uses manual test coordinates,
not a browser permission dialog. **Create ride request** saves `ride_id` and the
private `ride_tracking_token` in collection variables, ready for driver acceptance.
Do not override these output variables in an environment or export their values.

## Verification

```sh
uv run python -m pytest tests -q
uv run python tests/smoke_auth.py
```

The smoke test requires `npm ci` in `auth/`. It uses a temporary database and local ports 13001/18000, creates disposable credentials, starts both services, verifies signup escalation is blocked, validates real JWTs through FastAPI, restarts auth to verify persistent sessions/signing keys, checks login/logout and protected administrator operations, and stops its processes afterward.

## Shelter APIs and local demo

Public callers can `GET /api/shelters` and `GET /api/shelters/{id}`. Services are returned as arrays.
Authenticated shelter administrators can `GET /api/admin/shelters` and `PATCH /api/shelters/{id}` for assigned shelters; super administrators can manage all shelters. PATCH accepts `total_beds`, `available_beds`, `food_available`, and `services`. Capacity is checked against the resulting stored values. Booleans and counts use strict JSON types, and nulls and unknown fields return 422.

A super administrator can `POST /api/admin/shelter-assignments` with `auth_user_id` and `shelter_id`. The user must already have the Better Auth `shelter_admin` role. Missing users/shelters return 404; incorrect target roles return 422; duplicate assignments return 409. This role check reads Better Auth's user table, so configure both services to use the same SQLite file. No auth tables are written by FastAPI.

After configuring both `.env` files, run `npm run seed-demo` from `auth/`, then `uv run python -m app.seed` from `backend/`. This migrates Better Auth, creates a demo super administrator and shelter administrator using its server API, initializes application tables, seeds four fictional Birmingham shelters, and assigns the shelter administrator to Demo Downtown Shelter. All availability is demonstration data. Repeating these commands preserves existing account passwords and shelter availability.

Generated credentials are saved in `.demo-credentials.json` at the repository root with owner-only permissions. Read that local file to sign in. It, `.env` files, and SQLite files are ignored by Git. The database is initialized locally rather than shipped in the repository. The seed commands are explicit local operator commands and are never run automatically on server startup.
