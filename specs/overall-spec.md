# ShelterConnect — Authentication & Authorization Specification

## 1. Authentication Technology

**Authentication Provider:** Better Auth  
**Authorization Model:** Role-Based Access Control (RBAC)  
**Session Management:** Better Auth  
**API Authentication:** JWT Bearer Tokens  
**Backend Token Validation:** FastAPI + JWKS  
**Database:** SQLite

### Required Better Auth Plugins

- **Admin Plugin:** Manages user roles and permissions.
- **JWT Plugin:** Issues signed tokens for FastAPI authentication.

Better Auth is responsible for user identity and session management. FastAPI is responsible for protecting application resources based on the authenticated user's role.

---

## 2. User Roles

The application supports four roles.

| Role | Description |
|---|---|
| PUBLIC | Unauthenticated visitor |
| DRIVER | Registered volunteer driver |
| SHELTER_ADMIN | Administrator assigned to a shelter |
| SUPER_ADMIN | Application administrator |

`PUBLIC` is not a stored Better Auth role. It represents users without an authenticated session.

### 2.1 Public User

Authentication is not required.

**Permissions:**
- View shelter listings.
- View shelter availability.
- View shelter services and food availability.
- Share or manually enter pickup location.
- Submit transportation requests.
- Track their own request using a private access token.

**Restrictions:**
- Cannot modify shelters.
- Cannot accept transportation requests.
- Cannot view other users' private ride details.
- Cannot access driver or admin dashboards.

### 2.2 Driver

Authentication is required.

**Registration Fields:**
- First name
- Last name
- Email
- Password
- Phone number

Newly registered drivers receive the `DRIVER` role.

**Permissions:**
- View their driver profile.
- Update their own phone number.
- Toggle online/offline availability.
- View ride requests available to eligible drivers.
- Accept an available ride.
- View full pickup information for assigned rides.
- Update their assigned ride status.

**Restrictions:**
- Cannot update shelter information.
- Cannot modify other drivers.
- Cannot assign roles.
- Cannot modify rides assigned to other drivers.

### 2.3 Shelter Administrator

Authentication is required.

Shelter administrators are created or assigned by a `SUPER_ADMIN`.

**Permissions:**
- Access the shelter administration dashboard.
- View their assigned shelter.
- Update available bed counts.
- Update food availability.
- Update services offered.
- Update other permitted shelter details.

**Restrictions:**
- Cannot update shelters they are not assigned to.
- Cannot accept rides as a driver.
- Cannot modify user roles.
- Cannot access application-wide administrative functions.

### 2.4 Super Administrator

Authentication is required.

**Permissions:**
- View and manage all shelters.
- Assign administrators to shelters.
- Update user roles.
- Manage driver verification status.
- View application-wide operational information.

**Restrictions:**
- Must not expose private requester details unnecessarily.
- Must not allow public registration to grant administrator privileges.

For the hackathon, the super administrator account should be seeded during initialization.

---

## 3. Role Permission Matrix

| Action | Public | Driver | Shelter Admin | Super Admin |
|---|---|---|---|---|
| View shelters | Yes | Yes | Yes | Yes |
| View availability | Yes | Yes | Yes | Yes |
| Create ride request | Yes | Yes | Yes | Yes |
| View public ride status with private token | Yes | Yes | Yes | Yes |
| View driver requests | No | Yes | No | Yes |
| Accept ride | No | Yes | No | No |
| Update assigned ride | No | Yes | No | No |
| Update assigned shelter | No | No | Yes | Yes |
| Update any shelter | No | No | No | Yes |
| Verify drivers | No | No | No | Yes |
| Assign user roles | No | No | No | Yes |

Driver-specific permissions additionally require the driver to be verified and, where applicable, online.

---

## 4. Better Auth Integration

### 4.1 Authentication Service

Better Auth runs in a small Node.js service.

**Responsibilities:**
- User registration
- Email/password login
- Password hashing
- Session creation
- Session validation
- Logout
- Role management
- JWT issuance
- JWKS public key endpoint

Authentication endpoints are handled by Better Auth under:

```text
/api/auth/*
```

### 4.2 Better Auth Configuration

Enable:
- Email/password authentication
- Admin plugin
- JWT plugin
- SQLite database adapter
- Custom roles

Required application roles:

```text
driver
shelter_admin
super_admin
```

Better Auth's role configuration should define the permissions assigned to each role.

The `super_admin` role must receive explicit user-management permissions, while `driver` and `shelter_admin` receive only their required application permissions.

**Registration rule:** Public sign-up must never accept a caller-supplied role or verification status as authoritative.

Driver registration is the only public account creation workflow. Role assignment to `driver` must be enforced server-side, rather than by trusting a frontend-submitted role value.

A new driver should initially have `is_verified = false`. The hackathon demo may automatically approve that driver in a clearly marked simulation.

### 4.3 JWT Configuration

Better Auth issues signed JWTs for requests to FastAPI.

JWTs must contain or allow FastAPI to derive:

```json
{
  "sub": "better-auth-user-id",
  "role": "driver",
  "iss": "http://localhost:3001",
  "aud": "shelterconnect-api",
  "exp": 1795000000
}
```

The numeric expiration above is illustrative.

**Requirements:**
- `sub` identifies the authenticated Better Auth user.
- `role` identifies the user's current authorization role.
- `iss` identifies the Better Auth server.
- `aud` identifies the FastAPI backend.
- `exp` limits the token's lifetime.
- Tokens must be cryptographically signed.
- FastAPI must validate signatures using Better Auth's JWKS endpoint.

Recommended JWT expiration: 15 minutes.

The frontend should obtain API tokens through the authenticated Better Auth session and pass them to FastAPI as Bearer tokens.

Better Auth's session cookie is not interchangeable with the JWT used by FastAPI.

---

## 5. FastAPI Authentication and Authorization

FastAPI must independently validate authenticated requests.

### 5.1 JWT Verification

For each protected API request:

1. Extract the Bearer token from the Authorization header.
2. Retrieve the appropriate public signing key from the Better Auth JWKS endpoint.
3. Verify the JWT signature.
4. Validate issuer, audience, expiration, and permitted signing algorithm.
5. Extract the authenticated user ID.
6. Resolve the user's authorized role.
7. Apply endpoint permissions.
8. Allow or reject the request.

**Header example:**

```http
Authorization: Bearer <jwt-token>
```

**JWKS endpoint:**

```text
http://localhost:3001/api/auth/jwks
```

FastAPI should cache JWKS keys rather than downloading them on every request.

### 5.2 Authorization Dependencies

Implement reusable FastAPI dependencies:

```python
get_current_user()
require_role("driver")
require_role("shelter_admin")
require_role("super_admin")
```

Example endpoint:

```python
@router.patch("/shelters/{shelter_id}")
def update_shelter(
    shelter_id: int,
    payload: ShelterUpdate,
    user=Depends(require_role("shelter_admin"))
):
    ...
```

The role dependency verifies that the user possesses the required role.

The endpoint must additionally verify that the administrator is assigned to the requested shelter.

### 5.3 Resource Ownership

Role validation alone is insufficient.

The backend must also check resource ownership.

**Shelter administrator example:**

```text
Authenticated user:
  role = shelter_admin
  user_id = abc123

Requested shelter:
  shelter_id = 5

Authorization check:
  Is user abc123 assigned to shelter 5?
```

If yes, allow the update.

If no, return `403 Forbidden`.

**Driver example:**

A driver can update a ride only if:

```text
ride.driver_id == current_driver.id
```

A driver cannot supply another driver's ID to gain access to their rides.

### 5.4 Error Responses

| Status | Meaning |
|---|---|
| 401 Unauthorized | Missing, invalid, or expired authentication |
| 403 Forbidden | Authenticated but insufficient permissions |
| 404 Not Found | Requested resource does not exist or is intentionally hidden |
| 409 Conflict | Ride already accepted or invalid status transition |

### 5.5 Role Changes and Revocation

For the MVP, FastAPI can use verified short-lived JWT role claims.

Role changes may therefore take effect only after the existing JWT expires.

For production, critical administrative actions should check current role/verification status against an authoritative source or use a revocation mechanism.

---

## 6. Database Changes

Better Auth manages its own authentication-related tables, including users, sessions, accounts, and verification records, as well as plugin-specific tables.

Application data remains managed by SQLAlchemy and FastAPI.

### 6.1 `drivers`

Update the existing driver table:

| Field | Type | Description |
|---|---|---|
| id | INTEGER PK | Driver identifier |
| auth_user_id | TEXT UNIQUE | Better Auth user ID |
| phone_number | TEXT NOT NULL | Driver phone |
| is_verified | BOOLEAN | Driver verification status |
| is_available | BOOLEAN | Driver online/offline status |

Names and emails can be retrieved from Better Auth or duplicated into application records if needed.

Do not maintain a second password database inside FastAPI.

### 6.2 `shelter_admins`

Add a shelter administrator association table.

| Field | Type | Description |
|---|---|---|
| id | INTEGER PK | Assignment identifier |
| auth_user_id | TEXT | Better Auth user ID |
| shelter_id | INTEGER FK | Assigned shelter |

For the MVP, one administrator can manage one or more shelters.

### 6.3 Existing Tables

Keep:
- `shelters`
- `ride_requests`

Ride requests remain anonymous and do not require a Better Auth account.

**SQLite approach:** Both services may use a single SQLite database with separate auth and application tables. Only Better Auth should migrate its auth tables, and only SQLAlchemy should migrate application tables. Enable SQLite WAL mode and configure busy timeouts to reduce lock contention.

---

## 7. Protected API Endpoints

### Public Endpoints

| Method | Endpoint | Authentication |
|---|---|---|
| GET | `/api/shelters` | None |
| GET | `/api/shelters/{id}` | None |
| POST | `/api/rides` | None |
| GET | `/api/rides/{id}` | Private request token |

### Driver Endpoints

| Method | Endpoint | Required Role |
|---|---|---|
| GET | `/api/drivers/me` | DRIVER |
| PATCH | `/api/drivers/me` | DRIVER |
| PATCH | `/api/drivers/me/availability` | DRIVER |
| GET | `/api/drivers/requests` | DRIVER |
| POST | `/api/rides/{id}/accept` | DRIVER |
| PATCH | `/api/rides/{id}/status` | DRIVER |

### Shelter Admin Endpoints

| Method | Endpoint | Required Role |
|---|---|---|
| PATCH | `/api/shelters/{id}` | SHELTER_ADMIN or SUPER_ADMIN |
| GET | `/api/admin/shelters` | SHELTER_ADMIN or SUPER_ADMIN |

### Super Admin Endpoints

| Method | Endpoint | Required Role |
|---|---|---|
| PATCH | `/api/admin/drivers/{id}/verification` | SUPER_ADMIN |
| POST | `/api/admin/shelter-assignments` | SUPER_ADMIN |

Role assignment and user management should use Better Auth's protected Admin plugin operations rather than directly modifying auth tables from FastAPI.

---

## 8. Frontend Authentication

### 8.1 Authentication Client

React uses the official Better Auth client.

```typescript
import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: "http://localhost:3001"
});
```

Configure any required Admin or JWT client plugins alongside this client.

### 8.2 Authentication Pages

Required authenticated
