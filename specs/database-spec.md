# ShelterConnect — Database Specification

This document consolidates the application database outlined in `overall-spec.md`, `gavin-work-spec.md`, and `ben-work-spec.md`. It is a **schema specification**, not a migration. The backend implements it in `backend/app/models.py`; `app.database.init_db()` creates missing application tables on startup.

## Ownership and storage

- SQLite is the application database. FastAPI/SQLAlchemy owns the five application tables below. Better Auth owns its own user, session, account, verification, and plugin tables; **do not** create or migrate those tables from FastAPI.
- The services may share one SQLite file. If they do, enable `PRAGMA foreign_keys=ON` and `PRAGMA busy_timeout=30000` on **every** connection and `PRAGMA journal_mode=WAL` for the database. Configure both services to point to the same file explicitly; relative paths are resolved from each process's working directory.
- `auth_user_id` values are Better Auth user IDs, not SQLite foreign keys: Better Auth controls that identity and its schema. Application code must verify the authenticated identity/role before using these IDs.
- Store timestamps in UTC. SQLite has no native timezone-aware datetime type: consistently serialize UTC timestamps (for example, ISO 8601 strings) and parse them in the application. `updated_at` must be refreshed by the application on shelter changes.
- The SQL below defines the proposed application schema; SQLAlchemy models/migrations should produce equivalent constraints. SQLite `BOOLEAN` values are represented as integers `0` and `1`.

## Relationships

```text
Better Auth user ID ──< drivers.auth_user_id (unique)
Better Auth user ID ──< shelter_admins.auth_user_id
shelters.id       ──< shelter_admins.shelter_id
shelters.id       ──< ride_requests.shelter_id
drivers.id        ──< ride_requests.driver_id (nullable)
drivers.id        ─── cars.driver_id (unique; zero or one car)
```

A driver has at most one profile and at most one registered car. Drivers may create a profile before registering a car. An administrator may be assigned to multiple shelters, but the same assignment must not be duplicated. Rides are anonymous; they are not associated with a Better Auth requester account.

## Application tables (SQLite reference DDL)

```sql
CREATE TABLE shelters (
    id              INTEGER PRIMARY KEY,
    name            TEXT NOT NULL CHECK (length(trim(name)) > 0),
    address         TEXT NOT NULL CHECK (length(trim(address)) > 0),
    latitude        REAL,
    longitude       REAL,
    total_beds      INTEGER NOT NULL DEFAULT 0 CHECK (total_beds >= 0),
    available_beds  INTEGER NOT NULL DEFAULT 0
                    CHECK (available_beds >= 0 AND available_beds <= total_beds),
    food_available  INTEGER NOT NULL DEFAULT 0 CHECK (food_available IN (0, 1)),
    services        TEXT NOT NULL DEFAULT '[]',
    updated_at      TEXT NOT NULL,
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    CHECK ((latitude IS NULL) = (longitude IS NULL))
);

CREATE TABLE shelter_admins (
    id              INTEGER PRIMARY KEY,
    auth_user_id    TEXT NOT NULL CHECK (length(trim(auth_user_id)) > 0),
    shelter_id      INTEGER NOT NULL REFERENCES shelters(id),
    UNIQUE (auth_user_id, shelter_id)
);

CREATE INDEX ix_shelter_admins_shelter_id ON shelter_admins(shelter_id);

CREATE TABLE drivers (
    id              INTEGER PRIMARY KEY,
    auth_user_id    TEXT NOT NULL UNIQUE CHECK (length(trim(auth_user_id)) > 0),
    phone_number    TEXT NOT NULL CHECK (length(trim(phone_number)) > 0),
    is_verified     INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1)),
    is_available    INTEGER NOT NULL DEFAULT 0 CHECK (is_available IN (0, 1)),
    CHECK (is_verified = 1 OR is_available = 0)
);

CREATE TABLE cars (
    id              INTEGER PRIMARY KEY,
    driver_id       INTEGER NOT NULL UNIQUE REFERENCES drivers(id),
    make            TEXT NOT NULL CHECK (length(trim(make)) > 0),
    model           TEXT NOT NULL CHECK (length(trim(model)) > 0),
    color           TEXT NOT NULL CHECK (length(trim(color)) > 0),
    license_plate   TEXT NOT NULL CHECK (length(trim(license_plate)) > 0)
);

CREATE TABLE ride_requests (
    id                   INTEGER PRIMARY KEY,
    first_name           TEXT NOT NULL CHECK (length(trim(first_name)) > 0),
    last_name            TEXT NOT NULL CHECK (length(trim(last_name)) > 0),
    pickup_latitude      REAL,
    pickup_longitude     REAL,
    pickup_address       TEXT,
    shelter_id           INTEGER NOT NULL REFERENCES shelters(id),
    driver_id            INTEGER REFERENCES drivers(id),
    status               TEXT NOT NULL DEFAULT 'PENDING'
                         CHECK (status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    created_at           TEXT NOT NULL,
    accepted_at          TEXT,
    completed_at         TEXT,
    tracking_token_hash  TEXT NOT NULL UNIQUE,
    CHECK ((pickup_latitude IS NULL) = (pickup_longitude IS NULL)),
    CHECK (pickup_latitude IS NULL OR pickup_latitude BETWEEN -90 AND 90),
    CHECK (pickup_longitude IS NULL OR pickup_longitude BETWEEN -180 AND 180),
    CHECK (pickup_latitude IS NOT NULL OR length(trim(coalesce(pickup_address, ''))) > 0),
    CHECK (status != 'PENDING' OR driver_id IS NULL),
    CHECK (status NOT IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED') OR driver_id IS NOT NULL)
);

CREATE INDEX ix_ride_requests_shelter_id ON ride_requests(shelter_id);
CREATE INDEX ix_ride_requests_status_created_at ON ride_requests(status, created_at);
CREATE INDEX ix_ride_requests_driver_id ON ride_requests(driver_id);
-- Prevent one driver from holding multiple active rides, including concurrent attempts.
CREATE UNIQUE INDEX ux_ride_requests_one_active_per_driver
    ON ride_requests(driver_id)
    WHERE driver_id IS NOT NULL AND status IN ('ACCEPTED', 'IN_PROGRESS');
```

### Field and behavior notes

- `shelters.services` is a JSON-encoded array of service names; validate JSON shape in the application. Available beds are **reported capacity**, not a reservation or guaranteed admission. Seed data must be fictional and labeled as demonstration availability.
- `shelter_admins.auth_user_id` must refer to an authenticated account granted the `shelter_admin` role through Better Auth. A `super_admin` needs no assignment row to manage shelters.
- `drivers.phone_number` is a string, not an integer; preserve leading zeros and punctuation. Profile initialization derives `auth_user_id` from a verified JWT and is idempotent. Only a super admin (or explicitly marked local demo workflow) may set `is_verified`; a driver may go online only when verified. If verification is removed, set availability to false in the same transaction.
- `cars.driver_id` enforces at most one car per driver, including concurrent registrations. Update the existing car to change vehicle details. Make, model, color, and license plate are required nonblank strings. Preserve plate letters, leading zeros, and punctuation. Plates are not globally unique because issuing jurisdictions are not stored. Deleting a referenced driver is blocked; deleting a car does not delete its driver. Future car endpoints must derive ownership from the authenticated driver and only expose vehicle details to authorized callers (such as the assigned rider).
- `ride_requests.pickup_address` may accompany coordinates or replace them; coordinate pairs must be complete. Before assignment, pending-ride listings must not disclose full names or precise pickup coordinates. A general `pickup_area` can be derived from the address or an approved coarse location; it is not an extra stored column.
- Generate a cryptographically random private tracking token when a ride is created, return it only once, and store only a one-way hash in `tracking_token_hash`. A public status lookup requires that token; do not return personal pickup or driver phone data unnecessarily.
- A ride begins `PENDING`. Allowed transitions: `PENDING → ACCEPTED`, `PENDING → CANCELLED`, `ACCEPTED → IN_PROGRESS`, `ACCEPTED → CANCELLED`, `IN_PROGRESS → COMPLETED`. Set `accepted_at` when accepted and `completed_at` when completed. Transition and ownership checks belong in the application/transaction; the status `CHECK` only constrains the set of values.
- Acceptance must check the driver is verified, online, and without an active ride **inside a serialized transaction**, then conditionally update a pending, unassigned ride. In SQLite, `BEGIN IMMEDIATE` can serialize competing writers; check affected rows and return 409 on conflicts. The partial unique index adds a second safeguard against multiple active rides for the same driver.
- Prevent deleting a referenced shelter or driver by default (SQLite FK `NO ACTION`). Do not silently cascade-delete ride history, requester data, or shelter assignments. Define retention/privacy rules before introducing destructive operations.

## Not included

No second password store, Better Auth role/user tables, notification table, or reservation table is part of this application schema. Better Auth's actual tables and migrations depend on its configured version/plugins and must be managed by the auth service, not inferred from this SQL.
