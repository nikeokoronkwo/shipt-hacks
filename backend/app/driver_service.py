"""Driver workflow rules, SQLite transactions, and privacy-safe pending listings."""

from contextlib import contextmanager
import math

from sqlalchemy import select, text, update
from sqlalchemy.orm import Session

from app.models import Car, Driver, RideRequest, Shelter, utc_now

ACTIVE_STATUSES = ("ACCEPTED", "IN_PROGRESS")
TRANSITIONS = {"ACCEPTED": {"IN_PROGRESS", "CANCELLED"}, "IN_PROGRESS": {"COMPLETED"}}


class DriverWorkflowError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


@contextmanager
def serialized_write(db: Session):
    """Use a fresh session; acquire the writer lock before any reads.

    Eligibility and active-ride checks then share the same protected transaction
    as the conditional assignment. The partial unique index is a second safeguard.
    """
    try:
        db.execute(text("BEGIN IMMEDIATE"))
        yield
        db.commit()
    except Exception:
        db.rollback()
        raise


def get_profile(db: Session, user_id: str) -> Driver:
    driver = db.scalar(select(Driver).where(Driver.auth_user_id == user_id))
    if driver is None:
        raise DriverWorkflowError(404, "Driver profile not initialized")
    return driver


def initialize(db: Session, user_id: str, phone_number: str, vehicle: dict[str, str]) -> Driver:
    with serialized_write(db):
        driver = db.scalar(select(Driver).where(Driver.auth_user_id == user_id))
        if driver is None:
            driver = Driver(auth_user_id=user_id, phone_number=phone_number)
            db.add(driver)
        if driver.vehicle is None:
            driver.vehicle = Car(**vehicle)
    # Profile and vehicle creation commit together. Retries preserve existing data.
    return driver


def update_phone(db: Session, user_id: str, phone_number: str) -> Driver:
    with serialized_write(db):
        driver = get_profile(db, user_id)
        driver.phone_number = phone_number
    return driver


def set_availability(db: Session, user_id: str, is_available: bool) -> Driver:
    with serialized_write(db):
        driver = get_profile(db, user_id)
        if is_available and not driver.is_verified:
            raise DriverWorkflowError(403, "Driver must be verified to go online")
        driver.is_available = is_available
    return driver


def active_ride(db: Session, driver: Driver) -> RideRequest | None:
    return db.scalar(select(RideRequest).where(
        RideRequest.driver_id == driver.id,
        RideRequest.status.in_(ACTIVE_STATUSES),
    ))


def get_active_ride(db: Session, user_id: str) -> RideRequest | None:
    # Going offline must not prevent a driver from finishing an assigned ride.
    return active_ride(db, get_profile(db, user_id))


def require_eligible(driver: Driver) -> None:
    if not driver.is_verified:
        raise DriverWorkflowError(403, "Driver must be verified")
    if not driver.is_available:
        raise DriverWorkflowError(403, "Driver must be online")


def pickup_area(ride: RideRequest) -> str:
    if ride.pickup_latitude is not None and ride.pickup_longitude is not None:
        # Coarse ~10 km cell only. Never disclose exact coordinates or addresses.
        lat = math.floor(ride.pickup_latitude * 10) / 10
        lon = math.floor(ride.pickup_longitude * 10) / 10
        return f"Area {lat:.1f} to {lat + 0.1:.1f} latitude, {lon:.1f} to {lon + 0.1:.1f} longitude"
    # A free-form address is not a trustworthy city/area. Until geocoding exists,
    # deliberately withhold it instead of leaking house numbers or unit details.
    return "Address pickup (location details available after acceptance)"


def pending_requests(db: Session, user_id: str) -> list[dict]:
    driver = get_profile(db, user_id)
    require_eligible(driver)
    if active_ride(db, driver) is not None:
        return []
    rows = db.execute(select(RideRequest, Shelter.name).join(
        Shelter, Shelter.id == RideRequest.shelter_id,
    ).where(RideRequest.status == "PENDING").order_by(RideRequest.created_at, RideRequest.id))
    return [dict(
        id=ride.id, pickup_area=pickup_area(ride), shelter_id=ride.shelter_id,
        shelter_name=name, status=ride.status, created_at=ride.created_at,
    ) for ride, name in rows]


def accept_ride(db: Session, user_id: str, ride_id: int) -> RideRequest:
    with serialized_write(db):
        driver = get_profile(db, user_id)
        require_eligible(driver)
        if active_ride(db, driver) is not None:
            raise DriverWorkflowError(409, "Driver already has an active ride")
        if db.get(RideRequest, ride_id) is None:
            raise DriverWorkflowError(404, "Ride not found")
        result = db.execute(update(RideRequest).where(
            RideRequest.id == ride_id,
            RideRequest.driver_id.is_(None),
            RideRequest.status == "PENDING",
        ).values(driver_id=driver.id, status="ACCEPTED", accepted_at=utc_now()))
        if result.rowcount != 1:
            raise DriverWorkflowError(409, "Ride is no longer available")
    return db.get(RideRequest, ride_id)


def set_ride_status(db: Session, user_id: str, ride_id: int, status: str) -> RideRequest:
    with serialized_write(db):
        driver = get_profile(db, user_id)
        ride = db.get(RideRequest, ride_id)
        if ride is None:
            raise DriverWorkflowError(404, "Ride not found")
        if ride.driver_id != driver.id:
            raise DriverWorkflowError(403, "Only the assigned driver can update this ride")
        if status not in TRANSITIONS.get(ride.status, set()):
            raise DriverWorkflowError(409, "Invalid ride status transition")
        ride.status = status
        if status == "COMPLETED":
            ride.completed_at = utc_now()
    return ride
