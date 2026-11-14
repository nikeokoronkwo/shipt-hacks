
# Backend Developer 1 — Authentication, Authorization & Shelter Management

## 1. Overview

**Project:** ShelterConnect — ShiptHacks  
**Stack:** FastAPI, SQLAlchemy, SQLite, Better Auth (TypeScript/Node.js)  
**Responsibilities:** Authentication, role-based authorization, shelter APIs, shelter administration, database setup.

This developer owns the authentication infrastructure and all shelter-related functionality.

The implementation must provide reusable authentication dependencies that Developer 2 can integrate into driver and transportation endpoints.

---

## 2. Authentication — Better Auth

### 2.1 Setup

Create a separate TypeScript/Node.js authentication service using Better Auth.

Enable:

- Email/password authentication
- Admin plugin for role management
- JWT plugin for FastAPI integration
- SQLite database adapter
- Session management

### 2.2 Roles

Configure the following roles:

| Role | Description |
|---|---|
| `driver` | Registered transportation volunteer |
| `shelter_admin` | Administrator of assigned shelters |
| `super_admin` | Application administrator |

Unauthenticated users can access public shelter and ride-request endpoints.

Public registration must not allow users to assign themselves privileged roles.

### 2.3 Authentication Endpoints

Better Auth handles authentication under:

```text
/api/auth/*
```

Required functionality:

- Register account
- Log in
- Log out
- Retrieve current session
- Issue signed JWT for FastAPI
- Manage user roles

Driver registration must result in a trusted server-side assignment of the `driver` role.

Shelter administrators and super administrators must be created or assigned through trusted administrative operations.

### 2.4 JWT Integration

FastAPI must validate JWTs issued by Better Auth.

Configure JWTs with:

- User ID (`sub`)
- Role claim or a trusted mechanism to resolve roles
- Issuer (`iss`)
- Audience (`aud`)
- Expiration (`exp`)

Use the Better Auth JWKS endpoint to verify token signatures.

FastAPI must validate:

1. Token signature
2. Issuer
3. Audience
4. Expiration
5. Required role or permission

Invalid or missing tokens return `401 Unauthorized`.

Authenticated users without sufficient permissions return `403 Forbidden`.

### 2.5 Shared Authentication Dependencies

Implement:

```python
get_current_user()
require_role(role)
```

Expose a consistent authenticated user object:

```python
class CurrentUser(BaseModel):
    id: str
    role: str
```

Expected usage:

```python
@router.get("/protected")
def protected(
    user: CurrentUser = Depends(require_role("driver"))
):
    return {"user_id": user.id}
```

The actual dependency implementation must verify the JWT and enforce the role on the backend.

Developer 2 will import these dependencies.

---

## 3. Database Setup

Own the shared SQLAlchemy database configuration:

```text
app/database.py
```

Use SQLite as the database.

Configure:

- SQLAlchemy engine
- Database session dependency
- Declarative model base
- Table initialization
- SQLite foreign key enforcement

Enable SQLite WAL mode and a busy timeout if the Better Auth service and FastAPI access the same database file.

Better Auth owns its authentication tables. FastAPI/SQLAlchemy owns application tables.

Coordinate model imports so all application tables are registered before initialization.

---

## 4. Shelter Database Model

### `shelters`

| Field | Type | Description |
|---|---|---|
| id | INTEGER PK | Shelter identifier |
| name | TEXT NOT NULL | Shelter name |
| address | TEXT NOT NULL | Physical address |
| latitude | REAL | Latitude |
| longitude | REAL | Longitude |
| total_beds | INTEGER | Total bed capacity |
| available_beds | INTEGER | Available beds |
| food_available | BOOLEAN | Whether food is available |
| services | TEXT | JSON-encoded service list |
| updated_at | DATETIME | Last update time |

Validation:

- `total_beds >= 0`
- `available_beds >= 0`
- `available_beds <= total_beds`
- `food_available` must be a boolean.

### `shelter_admins`

Maps Better Auth users to shelters.

| Field | Type | Description |
|---|---|---|
| id | INTEGER PK | Assignment ID |
| auth_user_id | TEXT NOT NULL | Better Auth user ID |
| shelter_id | INTEGER FK | Assigned shelter |

A shelter administrator can manage only assigned shelters.

A super administrator can manage all shelters.

---

## 5. Shelter API Endpoints

### GET `/api/shelters`

**Authentication:** None

Returns all shelters.

Response example:

```json
[
  {
    "id": 1,
    "name": "Demo Birmingham Shelter",
    "address": "Example Address, Birmingham, AL",
    "latitude": 33.5186,
    "longitude": -86.8104,
    "total_beds": 50,
    "available_beds": 12,
    "food_available": true,
    "services": ["Showers", "Laundry"],
    "updated_at": "2026-11-14T10:00:00"
  }
]
```

### GET `/api/shelters/{id}`

**Authentication:** None

Returns details for a specific shelter.

Return `404` if the shelter does not exist.

### PATCH `/api/shelters/{id}`

**Authentication:** Required

**Roles:** `shelter_admin`, `super_admin`

Request:

```json
{
  "available_beds": 8,
  "food_available": true,
  "services": ["Showers", "Laundry", "Clothing"]
}
```

Requirements:

- Validate all updated values.
- Verify that a `shelter_admin` is assigned to the shelter.
- Allow `super_admin` to update any shelter.
- Update the `updated_at` timestamp.
- Persist changes in SQLite.
- Return the updated shelter.

### GET `/api/admin/shelters`

**Authentication:** Required

**Roles:** `shelter_admin`, `super_admin`

Returns:

- Assigned shelters for `shelter_admin`.
- All shelters for `super_admin`.

### POST `/api/admin/shelter-assignments`

**Authentication:** Required

**Role:** `super_admin`

Request:

```json
{
  "auth_user_id": "better-auth-user-id",
  "shelter_id": 1
}
```

Creates an administrator-to-shelter assignment.

---

## 6. Demo Data

Create a seed script containing 3–5 fictional Birmingham-area shelters.

Each shelter should have:

- Name
- Address
- Geographic coordinates
- Total bed count
- Available bed count
- Food availability
- Services

Seed one super administrator and at least one shelter administrator through Better Auth's supported account and role-management mechanisms.

Use clearly labeled demonstration availability rather than claiming real-time shelter data.

---

## 7. Project Structure

```text
auth/
├── src/
│   ├── auth.ts
│   ├── permissions.ts
│   └── server.ts
├── package.json
└── tsconfig.json

backend/
└── app/
    ├── main.py
    ├── database.py
    ├── auth/
    │   ├── jwt.py
    │   └── dependencies.py
    └── shelters/
        ├── models.py
        ├── schemas.py
        ├── router.py
        └── service.py
```

---

## 8. Integration Contract for Developer 2

Developer 1 must provide:

### Authentication imports

```python
from app.auth.dependencies import (
    get_current_user,
    require_role,
)
```

### Current user representation

```python
CurrentUser(
    id="better-auth-user-id",
    role="driver"
)
```

### Shared database imports

```python
from app.database import Base, get_db
```

### Shelter model

```python
from app.shelters.models import Shelter
```

Developer 2 must be able to reference `Shelter.id` as a foreign key without modifying the shelter module.

### Registration Coordination

Developer 1 owns the Better Auth registration flow and trusted `driver` role assignment.

Developer 2 owns the driver profile initialization endpoint.

The frontend must complete authentication before initializing the driver profile.

---

## 9. Acceptance Criteria

- [x] Better Auth service runs.
- [x] Email/password registration works.
- [x] Login/logout works.
- [x] Better Auth sessions persist.
- [x] Roles are configured.
- [x] Public users cannot create administrator accounts.
- [x] FastAPI verifies Better Auth JWTs.
- [x] Invalid JWTs return 401.
- [x] Insufficient permissions return 403.
- [x] Reusable role dependencies are implemented.
- [x] SQLite database initializes successfully.
- [x] Shelter listing endpoint works.
- [x] Shelter detail endpoint works.
- [x] Shelter administrators can update assigned shelters.
- [x] Shelter administrators cannot update unassigned shelters.
- [x] Super administrators can update all shelters.
- [x] Food availability can be updated.
- [x] Bed count validation works.
- [x] Demo shelters are seeded.

## 10. Definition of Done

Developer 1 is finished when authentication works, role checks are enforced by FastAPI, shelter data is available through public endpoints, and authorized administrators can update their shelters.

The shared authentication dependencies and database interfaces must be usable by Developer 2 without modifications.

## 11. Iteration 1 Progress — Backend Authentication

Scope approved by Ben: authentication service, trusted roles, FastAPI JWT validation, and verification/documentation. Shelter APIs and domain models remain for a later iteration.

- [x] Better Auth service and SQLite auth migrations.
- [x] Trusted driver signup and protected administrator role management.
- [x] JWT issuance and reusable FastAPI authentication/role dependencies (15 JWT/role tests passing).
- [x] End-to-end verification and startup documentation.

Implementation started 2026-11-14. Detailed execution record: [backend authentication](spec-backend-authentication.md).

Verification: TypeScript type check passed; 15 Python JWT/role tests passed; real HTTP smoke test passed using a temporary SQLite database. Confirmed role injection rejection, protected admin operations, JWT access to FastAPI, session persistence across restart, and login/logout. Setup: [auth README](../auth/README.md) and [backend README](../backend/README.md).

MVP limitation: issued JWTs remain valid for up to 15 minutes after logout or a role change. Shelter data, shelter permissions/assignments, driver profiles, and transportation endpoints are not part of iteration 1.


## 12. Iteration 2 Progress — Shelter Management

- [x] Public shelter listing and detail endpoints.
- [x] Assigned-shelter updates and super administrator access, with strict capacity/boolean/service validation and UTC timestamps.
- [x] Administrator shelter listing and super administrator assignment creation, including target role/reference validation and duplicate handling.
- [x] Stable `app.shelters.models.Shelter` import for Developer 2.
- [x] Repeatable local demo provisioning: four fictional Birmingham shelters, generated Better Auth super/shelter administrators, and one assignment.
- [x] Local SQLite initialized and seeded; database, credentials, and environment files excluded from future commits.

Completed 2026-11-14. Backend suite: 44 tests passed plus 53 subtests; auth TypeScript check passed. Real HTTP smoke verification covers Better Auth login/JWT issuance, both administrator roles, assignments, shelter reads/updates, forbidden access, and capacity errors. See [execution record](spec-shelter-management.md), [backend setup](../backend/README.md), and [demo account setup](../auth/README.md).

Driver profiles and transportation endpoints remain Developer 2's responsibility.
