"""FastAPI application for ShelterConnect's application domain."""

from __future__ import annotations

import hashlib
import os
import secrets
from collections.abc import Generator
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from math import floor

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Select, inspect, select, text, update
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session, joinedload

from shiptohome.auth import get_current_user, require_role
from shiptohome.database import SessionLocal, get_db, initialize_application_tables
from shiptohome.models import Driver, RideRequest, Shelter, ShelterAdmin
from shiptohome.schemas import (
    CurrentUser,
    DriverAvailabilityUpdate,
    DriverInitialize,
    DriverOut,
    DriverRideRequest,
    DriverUpdate,
    DriverVerificationUpdate,
    RideAssignedOut,
    RideCreate,
    RideCreated,
    RidePublicOut,
    RideStatusUpdate,
    ShelterAssignmentCreate,
    ShelterOut,
    ShelterUpdate,
)
from shiptohome.seed import seed_demo_shelters
from shiptohome.sms import send_sms


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> Generator[None, None, None]:
    initialize_application_tables()
    with SessionLocal() as db:
        seed_demo_shelters(db)
    yield


app = FastAPI(title="ShelterConnect API", version="0.1.0", lifespan=lifespan)
allowed_origins = [
    origin.strip()
    for origin in os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Tracking-Token"],
)


def get_shelter_or_404(db: Session, shelter_id: int) -> Shelter:
    shelter = db.get(Shelter, shelter_id)
    if shelter is None:
        raise HTTPException(status_code=404, detail="Shelter not found.")
    return shelter


def get_driver_or_404(db: Session, auth_user_id: str) -> Driver:
    driver = db.scalar(select(Driver).where(Driver.auth_user_id == auth_user_id))
    if driver is None:
        raise HTTPException(
            status_code=404,
            detail="Set up your driver profile before using driver tools.",
        )
    return driver


def require_eligible_driver(db: Session, user: CurrentUser) -> Driver:
    driver = get_driver_or_404(db, user.id)
    require_verified_driver_phone(db, driver, user)
    if not driver.is_verified:
        raise HTTPException(status_code=403, detail="Your driver profile has not been verified.")
    if not driver.is_available:
        raise HTTPException(status_code=403, detail="Set yourself online before viewing requests.")
    return driver


def require_verified_driver_phone(db: Session, driver: Driver, user: CurrentUser) -> None:
    if not user.phone_number or not user.phone_number_verified:
        changed = driver.is_available or driver.sms_notifications_enabled
        driver.is_available = False
        driver.sms_notifications_enabled = False
        if changed:
            db.commit()
        raise HTTPException(status_code=403, detail="Verify your phone number before using driver tools.")
    if driver.phone_number != user.phone_number:
        driver.phone_number = user.phone_number
        driver.is_available = False
        driver.sms_notifications_enabled = False
        db.commit()
        raise HTTPException(status_code=409, detail="Your verified phone changed. Review SMS consent and go online again.")


def pickup_area(ride: RideRequest) -> str:
    if ride.pickup_latitude is not None and ride.pickup_longitude is not None:
        lat = floor(ride.pickup_latitude * 10) / 10
        lon = floor(ride.pickup_longitude * 10) / 10
        return f"Area {lat:.1f} to {lat + 0.1:.1f} latitude, {lon:.1f} to {lon + 0.1:.1f} longitude"
    return "Address pickup (location details available after acceptance)"


def notify_available_drivers(shelter_name: str) -> None:
    """Send a minimal alert only to verified, online, opted-in drivers."""
    with SessionLocal() as db:
        if not inspect(db.connection()).has_table("user"):
            return
        columns = {column["name"] for column in inspect(db.connection()).get_columns("user")}
        if not {"phoneNumber", "phoneNumberVerified", "role"}.issubset(columns):
            return
        recipients = list(db.scalars(text(
            'SELECT d.phone_number FROM drivers AS d JOIN "user" AS u ON u.id = d.auth_user_id '
            'WHERE d.is_verified = 1 AND d.is_available = 1 AND d.sms_notifications_enabled = 1 '
            'AND u.role = \'driver\' AND u."phoneNumberVerified" = 1 AND u."phoneNumber" = d.phone_number '
            'AND NOT EXISTS (SELECT 1 FROM ride_requests AS r WHERE r.driver_id = d.id '
            "AND r.status IN ('ACCEPTED', 'IN_PROGRESS'))"
        )))

    message = (
        f"ShelterConnect: A ride request is available for {shelter_name}. "
        "Sign in to review details. Reply STOP to stop all ShelterConnect texts."
    )
    unsubscribed_numbers = [
        phone_number
        for phone_number in recipients
        if send_sms(phone_number, message) == "unsubscribed"
    ]
    if unsubscribed_numbers:
        # Twilio blocks future sends after STOP. Mirror that choice locally so
        # the app also stops attempting alerts to opted-out numbers.
        with SessionLocal() as db:
            db.execute(
                update(Driver)
                .where(Driver.phone_number.in_(unsubscribed_numbers))
                .values(sms_notifications_enabled=False)
            )
            db.commit()


def public_ride(ride: RideRequest) -> RidePublicOut:
    return RidePublicOut(
        id=ride.id,
        shelter_id=ride.shelter_id,
        status=ride.status,
        created_at=ride.created_at,
        accepted_at=ride.accepted_at,
        completed_at=ride.completed_at,
        driver_assigned=ride.driver_id is not None,
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/shelters", response_model=list[ShelterOut])
def list_shelters(db: Session = Depends(get_db)) -> list[Shelter]:
    return list(db.scalars(select(Shelter).order_by(Shelter.name)))


@app.get("/api/shelters/{shelter_id}", response_model=ShelterOut)
def get_shelter(shelter_id: int, db: Session = Depends(get_db)) -> Shelter:
    return get_shelter_or_404(db, shelter_id)


@app.patch("/api/shelters/{shelter_id}", response_model=ShelterOut)
def update_shelter(
    shelter_id: int,
    payload: ShelterUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role("shelter_admin", "super_admin")),
) -> Shelter:
    shelter = get_shelter_or_404(db, shelter_id)
    if user.role == "shelter_admin":
        assignment = db.scalar(
            select(ShelterAdmin.id).where(
                ShelterAdmin.auth_user_id == user.id,
                ShelterAdmin.shelter_id == shelter_id,
            )
        )
        if assignment is None:
            raise HTTPException(status_code=403, detail="You are not assigned to this shelter.")

    changes = payload.model_dump(exclude_unset=True)
    total_beds = changes.get("total_beds", shelter.total_beds)
    available_beds = changes.get("available_beds", shelter.available_beds)
    if available_beds > total_beds:
        raise HTTPException(
            status_code=422,
            detail="available_beds must not exceed total_beds.",
        )
    for field, value in changes.items():
        setattr(shelter, field, value)
    shelter.updated_at = utcnow()
    db.commit()
    db.refresh(shelter)
    return shelter


@app.get("/api/admin/shelters", response_model=list[ShelterOut])
def list_administrable_shelters(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role("shelter_admin", "super_admin")),
) -> list[Shelter]:
    if user.role == "super_admin":
        return list(db.scalars(select(Shelter).order_by(Shelter.name)))
    query = (
        select(Shelter)
        .join(ShelterAdmin)
        .where(ShelterAdmin.auth_user_id == user.id)
        .order_by(Shelter.name)
    )
    return list(db.scalars(query))


@app.post("/api/admin/shelter-assignments", status_code=status.HTTP_201_CREATED)
def create_shelter_assignment(
    payload: ShelterAssignmentCreate,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_role("super_admin")),
) -> dict[str, int | str]:
    get_shelter_or_404(db, payload.shelter_id)
    assignment = ShelterAdmin(**payload.model_dump())
    db.add(assignment)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="That administrator is already assigned.") from None
    db.refresh(assignment)
    return {"id": assignment.id, "auth_user_id": assignment.auth_user_id, "shelter_id": assignment.shelter_id}


@app.post("/api/drivers/me/initialize", response_model=DriverOut, status_code=status.HTTP_201_CREATED)
def initialize_driver(
    payload: DriverInitialize,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role("driver")),
) -> Driver:
    if not user.phone_number or not user.phone_number_verified:
        existing = db.scalar(select(Driver).where(Driver.auth_user_id == user.id))
        if existing is not None:
            existing.is_available = False
            existing.sms_notifications_enabled = False
            db.commit()
        raise HTTPException(
            status_code=403,
            detail="Verify your phone number with an SMS code before setting up a driver profile.",
        )
    existing = db.scalar(select(Driver).where(Driver.auth_user_id == user.id))
    if existing is not None:
        phone_changed = existing.phone_number != user.phone_number
        existing.phone_number = user.phone_number
        existing.sms_notifications_enabled = payload.sms_notifications_enabled
        if phone_changed:
            existing.is_available = False
        db.commit()
        db.refresh(existing)
        return existing
    driver = Driver(
        auth_user_id=user.id,
        phone_number=user.phone_number,
        sms_notifications_enabled=payload.sms_notifications_enabled,
    )
    db.add(driver)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # A concurrent, identical initialization is still idempotent.
        return get_driver_or_404(db, user.id)
    db.refresh(driver)
    return driver


@app.get("/api/drivers/me", response_model=DriverOut)
def get_my_driver(
    db: Session = Depends(get_db), user: CurrentUser = Depends(require_role("driver"))
) -> Driver:
    driver = get_driver_or_404(db, user.id)
    require_verified_driver_phone(db, driver, user)
    return driver


@app.patch("/api/drivers/me", response_model=DriverOut)
def update_my_driver(
    payload: DriverUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role("driver")),
) -> Driver:
    driver = get_driver_or_404(db, user.id)
    if not user.phone_number or not user.phone_number_verified:
        driver.is_available = False
        driver.sms_notifications_enabled = False
        db.commit()
        raise HTTPException(status_code=403, detail="Verify your phone number before updating driver settings.")
    phone_changed = driver.phone_number != user.phone_number
    driver.phone_number = user.phone_number
    driver.sms_notifications_enabled = payload.sms_notifications_enabled
    if phone_changed:
        driver.is_available = False
    db.commit()
    db.refresh(driver)
    return driver


@app.patch("/api/drivers/me/availability", response_model=DriverOut)
def update_driver_availability(
    payload: DriverAvailabilityUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role("driver")),
) -> Driver:
    driver = get_driver_or_404(db, user.id)
    require_verified_driver_phone(db, driver, user)
    if payload.is_available and not driver.is_verified:
        raise HTTPException(status_code=403, detail="Only verified drivers can go online.")
    driver.is_available = payload.is_available
    db.commit()
    db.refresh(driver)
    return driver


@app.patch("/api/admin/drivers/{driver_id}/verification", response_model=DriverOut)
def set_driver_verification(
    driver_id: int,
    payload: DriverVerificationUpdate,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_role("super_admin")),
) -> Driver:
    driver = db.get(Driver, driver_id)
    if driver is None:
        raise HTTPException(status_code=404, detail="Driver not found.")
    driver.is_verified = payload.is_verified
    if not payload.is_verified:
        driver.is_available = False
    db.commit()
    db.refresh(driver)
    return driver


@app.post("/api/rides", response_model=RideCreated, status_code=status.HTTP_201_CREATED)
def create_ride(
    payload: RideCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> RideCreated:
    shelter = get_shelter_or_404(db, payload.shelter_id)
    if shelter.available_beds <= 0:
        raise HTTPException(
            status_code=409,
            detail="This demo shelter currently reports no available beds.",
        )
    tracking_token = secrets.token_urlsafe(32)
    ride = RideRequest(
        **payload.model_dump(),
        status="PENDING",
        tracking_token_hash=hashlib.sha256(tracking_token.encode()).hexdigest(),
    )
    db.add(ride)
    db.commit()
    db.refresh(ride)
    background_tasks.add_task(notify_available_drivers, shelter.name)
    return RideCreated(id=ride.id, status=ride.status, tracking_token=tracking_token)


@app.get("/api/rides/{ride_id}", response_model=RidePublicOut)
def get_public_ride(
    ride_id: int,
    x_tracking_token: str | None = Header(default=None, alias="X-Tracking-Token"),
    tracking_token: str | None = Query(default=None, include_in_schema=False),
    db: Session = Depends(get_db),
) -> RidePublicOut:
    token = x_tracking_token or tracking_token
    if not token:
        raise HTTPException(status_code=401, detail="A ride tracking token is required.")
    ride = db.get(RideRequest, ride_id)
    if ride is None or not secrets.compare_digest(
        ride.tracking_token_hash, hashlib.sha256(token.encode()).hexdigest()
    ):
        raise HTTPException(status_code=404, detail="Ride not found.")
    return public_ride(ride)


@app.get("/api/drivers/me/active-ride", response_model=RideAssignedOut | None)
def active_driver_ride(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role("driver")),
) -> RideAssignedOut | None:
    driver = get_driver_or_404(db, user.id)
    ride = db.scalar(select(RideRequest).where(
        RideRequest.driver_id == driver.id,
        RideRequest.status.in_(("ACCEPTED", "IN_PROGRESS")),
    ))
    return RideAssignedOut.model_validate(ride) if ride else None


@app.get("/api/drivers/requests", response_model=list[DriverRideRequest])
def driver_requests(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role("driver")),
) -> list[DriverRideRequest]:
    driver = get_driver_or_404(db, user.id)
    require_verified_driver_phone(db, driver, user)
    if not driver.is_verified:
        raise HTTPException(status_code=403, detail="Your driver profile has not been verified.")
    active_id = db.scalar(select(RideRequest.id).where(
        RideRequest.driver_id == driver.id,
        RideRequest.status.in_(("ACCEPTED", "IN_PROGRESS")),
    ))
    if active_id is not None:
        return []
    if not driver.is_available:
        raise HTTPException(status_code=403, detail="Set yourself online before viewing requests.")
    query: Select[tuple[RideRequest]] = (
        select(RideRequest)
        .options(joinedload(RideRequest.shelter))
        .where(RideRequest.status == "PENDING")
        .order_by(RideRequest.created_at.desc())
    )
    rides = db.scalars(query)
    return [
        DriverRideRequest(
            id=ride.id,
            pickup_area=pickup_area(ride),
            shelter_id=ride.shelter_id,
            shelter_name=ride.shelter.name,
            status=ride.status,
            created_at=ride.created_at,
        )
        for ride in rides
    ]


@app.post("/api/rides/{ride_id}/accept", response_model=RideAssignedOut)
def accept_ride(
    ride_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role("driver")),
) -> RideAssignedOut:
    # BEGIN IMMEDIATE serializes competing accepts before the eligible-driver
    # checks and the conditional update; the partial index is a second guard.
    try:
        db.execute(text("BEGIN IMMEDIATE"))
        driver = require_eligible_driver(db, user)
        active_ride = db.scalar(
            select(RideRequest.id).where(
                RideRequest.driver_id == driver.id,
                RideRequest.status.in_(("ACCEPTED", "IN_PROGRESS")),
            )
        )
        if active_ride is not None:
            raise HTTPException(status_code=409, detail="Finish your active ride before accepting another.")
        result = db.execute(
            update(RideRequest)
            .where(
                RideRequest.id == ride_id,
                RideRequest.driver_id.is_(None),
                RideRequest.status == "PENDING",
            )
            .values(driver_id=driver.id, status="ACCEPTED", accepted_at=utcnow())
        )
        if result.rowcount != 1:
            raise HTTPException(status_code=409, detail="This ride is no longer available.")
        driver.is_available = False
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except (IntegrityError, OperationalError):
        db.rollback()
        raise HTTPException(status_code=409, detail="This ride is no longer available.") from None

    ride = db.get(RideRequest, ride_id)
    if ride is None:  # Defensive: the conditional update above succeeded.
        raise HTTPException(status_code=404, detail="Ride not found.")
    return RideAssignedOut.model_validate(ride)


@app.patch("/api/rides/{ride_id}/status", response_model=RideAssignedOut)
def update_ride_status(
    ride_id: int,
    payload: RideStatusUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role("driver")),
) -> RideAssignedOut:
    driver = get_driver_or_404(db, user.id)
    ride = db.get(RideRequest, ride_id)
    if ride is None:
        raise HTTPException(status_code=404, detail="Ride not found.")
    if ride.driver_id != driver.id:
        raise HTTPException(status_code=403, detail="This ride is not assigned to you.")

    allowed_transitions = {
        "ACCEPTED": {"IN_PROGRESS", "CANCELLED"},
        "IN_PROGRESS": {"COMPLETED"},
    }
    if payload.status not in allowed_transitions.get(ride.status, set()):
        raise HTTPException(status_code=409, detail="That ride status transition is not allowed.")
    ride.status = payload.status
    if payload.status == "COMPLETED":
        ride.completed_at = utcnow()
    db.commit()
    db.refresh(ride)
    return RideAssignedOut.model_validate(ride)
