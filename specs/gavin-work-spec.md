# Backend Developer 2 — Driver Management & Transportation System

## 1. Overview

**Project:** ShelterConnect — ShiptHacks  
**Stack:** Python, FastAPI, SQLAlchemy, SQLite  
**Responsibilities:** Driver profiles, transportation requests, driver availability, ride assignment, ride status tracking, and notifications.

This developer owns the transportation workflow from the moment a shelter seeker requests a ride until the trip is completed.

Authentication and role validation are provided by Developer 1.

---

## 2. Driver Management

### 2.1 Driver Registration

Driver authentication is managed by Better Auth.

The driver profile is stored separately in the application database.

Registration workflow:

1. Driver registers through Better Auth.
2. Better Auth creates the user account and assigns the `driver` role through a trusted server-side workflow.
3. Frontend retrieves an authenticated JWT.
4. Frontend calls the driver initialization endpoint.
5. FastAPI validates the JWT.
6. FastAPI creates the driver profile using the authenticated Better Auth user ID.

### 2.2 Driver Model

Create the `drivers` table.

| Field | Type | Description |
|---|---|---|
| id | INTEGER PK | Driver ID |
| auth_user_id | TEXT UNIQUE NOT NULL | Better Auth user ID |
| phone_number | TEXT NOT NULL | Driver phone number |
| is_verified | BOOLEAN | Verification status |
| is_available | BOOLEAN | Online/offline status |

Driver names and emails are managed by Better Auth.

Phone numbers must be stored as strings.

### 2.3 Driver Verification

Driver verification is mocked for the hackathon.

New driver profiles should default to:

```json
{
  "is_verified": false,
  "is_available": false
}
```

For demo purposes, an explicit test-only verification operation can set `is_verified = true`.

The public driver profile update endpoint must not allow drivers to set their own verification status.

### 2.4 Driver Availability

Verified drivers can toggle between:

- Online
- Offline

Only verified and online drivers are eligible for new ride requests.

Drivers with active rides cannot accept another request.

---

## 3. Driver API Endpoints

### POST `/api/drivers/me/initialize`

**Authentication:** Required  
**Role:** `driver`

Request:

```json
{
  "phone_number": "2055550100"
}
```

Creates a driver profile associated with the authenticated Better Auth user ID.

Requirements:

- Do not accept `auth_user_id` from the request body.
- Derive the identity from the validated JWT.
- Reject missing phone numbers.
- Do not allow callers to set `is_verified`.
- Prevent duplicate driver profiles.
- Make initialization idempotent.

### GET `/api/drivers/me`

**Authentication:** Required  
**Role:** `driver`

Returns the authenticated driver's profile.

### PATCH `/api/drivers/me`

**Authentication:** Required  
**Role:** `driver`

Allows the driver to update their phone number.

Request:

```json
{
  "phone_number": "2055550123"
}
```

### PATCH `/api/drivers/me/availability`

**Authentication:** Required  
**Role:** `driver`

Request:

```json
{
  "is_available": true
}
```

Requirements:

- Driver must be verified to go online.
- Availability changes must persist in SQLite.
- Unverified drivers cannot go online.

---

## 4. Transportation Requests

### 4.1 Anonymous Ride Requests

Shelter seekers do not need accounts.

Required fields:

- First name
- Last name
- Pickup location
- Destination shelter ID

Pickup location may be provided through browser geolocation or manually entered as an address.

The backend creates a transportation request with status `PENDING`.

### 4.2 Ride Request Model

Create the `ride_requests` table.

| Field | Type | Description |
|---|---|---|
| id | INTEGER PK | Ride request ID |
| first_name | TEXT NOT NULL | Requester first name |
| last_name | TEXT NOT NULL | Requester last name |
| pickup_latitude | REAL NULL | Pickup latitude |
| pickup_longitude | REAL NULL | Pickup longitude |
| pickup_address | TEXT NULL | Pickup address |
| shelter_id | INTEGER FK | Destination shelter |
| driver_id | INTEGER FK NULL | Assigned driver |
| status | TEXT | Ride status |
| created_at | DATETIME | Creation timestamp |
| accepted_at | DATETIME NULL | Acceptance timestamp |
| completed_at | DATETIME NULL | Completion timestamp |
| tracking_token_hash | TEXT | Hash of private tracking token |

At least one usable pickup location representation must be provided.

`pickup_latitude` and `pickup_longitude` must be supplied together when using coordinates.

### 4.3 Ride Statuses

```text
PENDING
ACCEPTED
IN_PROGRESS
COMPLETED
CANCELLED
```

Allowed transitions:

```text
PENDING → ACCEPTED
PENDING → CANCELLED
ACCEPTED → IN_PROGRESS
ACCEPTED → CANCELLED
IN_PROGRESS → COMPLETED
```

Invalid status transitions should return `409 Conflict`.

---

## 5. Transportation API Endpoints

### POST `/api/rides`

**Authentication:** None

Request:

```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "pickup_latitude": 33.5207,
  "pickup_longitude": -86.8025,
  "pickup_address": "Downtown Birmingham",
  "shelter_id": 1
}
```

Requirements:

- Validate required fields.
- Verify the destination shelter exists.
- Check that the shelter reports available beds.
- Generate a secure random tracking token.
- Store only the tracking token hash.
- Create a ride with status `PENDING`.
- Return the ride ID, status, and tracking token.

Example response:

```json
{
  "id": 1,
  "status": "PENDING",
  "tracking_token": "example-private-token"
}
```

A reported available bed is not a guaranteed reservation. The UI must communicate that shelter admission has not been confirmed.

### GET `/api/rides/{id}`

**Authentication:** Private tracking token

Returns the request status for the shelter seeker.

Requirements:

- Validate the private tracking token.
- Return the ride status.
- Return limited assigned-driver information after acceptance.
- Do not expose driver phone numbers unless explicitly needed for a safe, approved contact workflow.
- Do not expose requester personal details unnecessarily.

### GET `/api/drivers/requests`

**Authentication:** Required  
**Role:** `driver`

Returns pending requests for eligible drivers.

Requirements:

- Driver must be verified.
- Driver must be online.
- Only include requests with status `PENDING`.
- Do not expose full requester names or precise pickup coordinates before assignment.
- Include enough information to identify the general pickup area and destination shelter.

Example response:

```json
[
  {
    "id": 1,
    "pickup_area": "Downtown Birmingham",
    "shelter_id": 2,
    "status": "PENDING",
    "created_at": "2026-11-14T10:30:00"
  }
]
```

### POST `/api/rides/{id}/accept`

**Authentication:** Required  
**Role:** `driver`

Requirements:

1. Verify the authenticated user has a driver profile.
2. Verify the driver is approved.
3. Verify the driver is online.
4. Verify the driver has no active ride.
5. Verify the requested ride is `PENDING`.
6. Atomically assign the ride to the driver.
7. Set status to `ACCEPTED`.
8. Update `accepted_at`.
9. Return assigned ride information.

The frontend must not supply a `driver_id` to determine which driver receives the ride.

The backend resolves the driver from the authenticated user's ID.

### PATCH `/api/rides/{id}/status`

**Authentication:** Required  
**Role:** `driver`

Request:

```json
{
  "status": "IN_PROGRESS"
}
```

Requirements:

- Only the assigned driver can update the ride.
- Validate status transitions.
- Update timestamps when appropriate.
- Persist changes to SQLite.

---

## 6. Atomic Ride Assignment

Prevent two drivers from accepting the same ride.

Use a conditional SQL update inside a database transaction.

```sql
UPDATE ride_requests
SET driver_id = :driver_id,
    status = 'ACCEPTED',
    accepted_at = CURRENT_TIMESTAMP
WHERE id = :ride_id
  AND driver_id IS NULL
  AND status = 'PENDING';
```

Check the number of affected rows.

- `1` row updated: acceptance successful.
- `0` rows updated: ride unavailable; return HTTP 409.

For the single-active-ride rule, serialize acceptance attempts using SQLite transaction controls and perform the driver's active-ride check within the same protected transaction.

A partial unique index on active rides may also be used as a database-level safeguard.

---

## 7. Driver Notifications

Use HTTP polling rather than WebSockets.

### Notification Workflow

1. A new ride request is created.
2. The request is stored as `PENDING`.
3. Online driver dashboards poll for pending requests.
4. The frontend detects new request IDs.
5. The frontend displays an in-app notification.
6. Drivers click the notification to open ride details.
7. Once a driver accepts, the request disappears from other drivers' pending lists.

### Polling Interval

```text
3–5 seconds
```

Endpoint:

```http
GET /api/drivers/requests
```

A separate notification table is not required.

For the hackathon, pending ride requests themselves act as the notification source.

---

## 8. Integration with Developer 1

Developer 2 uses the shared authentication dependencies provided by Developer 1.

### Required Imports

```python
from app.auth.dependencies import (
    get_current_user,
    require_role,
)
```

### Authenticated User

```python
class CurrentUser(BaseModel):
    id: str
    role: str
```

### Example Protected Endpoint

```python
@router.get("/drivers/me")
def get_my_profile(
    user: CurrentUser = Depends(require_role("driver")),
    db: Session = Depends(get_db),
):
    driver = (
        db.query(Driver)
        .filter(Driver.auth_user_id == user.id)
        .first()
    )
    return driver
```

### Shelter Model Relationship

Use Developer 1's shelter model:

```python
from app.shelters.models import Shelter
```

The ride request references:

```python
shelter_id = Column(
    Integer,
    ForeignKey("shelters.id"),
    nullable=False
)
```

Developer 2 should not modify the shelter model unless both developers agree on the change.

---

## 9. Mock Authentication During Development

To avoid waiting for Developer 1, implement driver and ride logic using FastAPI dependency overrides.

Example test user:

```python
def mock_current_driver():
    return CurrentUser(
        id="demo-driver-user",
        role="driver",
    )
```

Use this mock only in local tests.

When Developer 1 finishes authentication integration, switch to the real JWT-verifying dependencies.

Never expose an unauthenticated mock-driver mode in a publicly accessible deployment.

---

## 10. Project Structure

```text
backend/
└
