"""Anonymous ride creation business rules, persistence, and private tokens."""

import hashlib
import secrets

from sqlalchemy.orm import Session

from app.models import RideRequest, Shelter


class RideCreationError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def create_ride(db: Session, *, first_name: str, last_name: str, shelter_id: int,
                pickup_latitude: float | None = None, pickup_longitude: float | None = None,
                pickup_address: str | None = None) -> dict:
    with db.begin():
        shelter = db.get(Shelter, shelter_id)
        if shelter is None:
            raise RideCreationError(404, "Destination shelter not found")
        if shelter.available_beds <= 0:
            raise RideCreationError(409, "Destination shelter reports no available beds")

        # Reported capacity is advisory, not a reservation. Do not decrement beds.
        token = secrets.token_urlsafe(32)
        ride = RideRequest(
            first_name=first_name, last_name=last_name,
            pickup_latitude=pickup_latitude, pickup_longitude=pickup_longitude,
            pickup_address=pickup_address, shelter_id=shelter_id, status="PENDING",
            tracking_token_hash=hashlib.sha256(token.encode("utf-8")).hexdigest(),
        )
        db.add(ride)
        db.flush()
        ride_id = ride.id
    # Return the raw token once, never store it or include it in driver responses.
    return {"id": ride_id, "status": "PENDING", "tracking_token": token}
