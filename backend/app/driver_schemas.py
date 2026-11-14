"""Driver API contracts and request validation; no database or business rules."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

PhoneNumber = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, strict=True)]


class PhoneInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    phone_number: PhoneNumber


VehicleText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, strict=True)]


class VehicleInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    make: VehicleText
    model: VehicleText
    color: VehicleText
    license_plate: VehicleText


class InitializeInput(PhoneInput):
    vehicle: VehicleInput


class VehicleProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    make: str
    model: str
    color: str
    license_plate: str


class AvailabilityInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_available: bool = Field(strict=True)


class StatusInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    # Transitions (including unknown statuses) are business conflicts, not 422s.
    status: str


class DriverProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    auth_user_id: str
    phone_number: str
    is_verified: bool
    is_available: bool
    vehicle: VehicleProfile | None


class PendingRequest(BaseModel):
    id: int
    pickup_area: str
    shelter_id: int
    shelter_name: str
    status: str
    created_at: str


class AssignedRide(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    first_name: str
    last_name: str
    pickup_latitude: float | None
    pickup_longitude: float | None
    pickup_address: str | None
    shelter_id: int
    driver_id: int
    status: str
    created_at: str
    accepted_at: str | None
    completed_at: str | None
