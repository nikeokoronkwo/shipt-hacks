"""Thin HTTP routes: validated inputs and authenticated identity to workflow calls."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import driver_service
from app.auth.dependencies import CurrentUser, require_role
from app.database import get_db
from app.driver_schemas import AssignedRide, AvailabilityInput, DriverProfile, InitializeInput, PendingRequest, PhoneInput, StatusInput

router = APIRouter(prefix="/api", tags=["drivers"])
DriverUser = Annotated[CurrentUser, Depends(require_role("driver"))]
Database = Annotated[Session, Depends(get_db)]


@router.post("/drivers/me/initialize", response_model=DriverProfile)
def initialize_driver(body: InitializeInput, user: DriverUser, db: Database):
    return driver_service.initialize(db, user.id, body.phone_number, body.vehicle.model_dump())


@router.get("/drivers/me", response_model=DriverProfile)
def get_profile(user: DriverUser, db: Database):
    return driver_service.get_profile(db, user.id)


@router.patch("/drivers/me", response_model=DriverProfile)
def update_profile(body: PhoneInput, user: DriverUser, db: Database):
    return driver_service.update_phone(db, user.id, body.phone_number)


@router.patch("/drivers/me/availability", response_model=DriverProfile)
def update_availability(body: AvailabilityInput, user: DriverUser, db: Database):
    return driver_service.set_availability(db, user.id, body.is_available)


@router.get("/drivers/me/active-ride", response_model=AssignedRide | None)
def get_active_ride(user: DriverUser, db: Database):
    return driver_service.get_active_ride(db, user.id)


@router.get("/drivers/requests", response_model=list[PendingRequest])
def pending_requests(user: DriverUser, db: Database):
    return driver_service.pending_requests(db, user.id)


@router.post("/rides/{ride_id}/accept", response_model=AssignedRide)
def accept_ride(ride_id: int, user: DriverUser, db: Database):
    return driver_service.accept_ride(db, user.id, ride_id)


@router.patch("/rides/{ride_id}/status", response_model=AssignedRide)
def update_ride_status(ride_id: int, body: StatusInput, user: DriverUser, db: Database):
    return driver_service.set_ride_status(db, user.id, ride_id, body.status)
