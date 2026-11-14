from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictInt,
    StringConstraints,
    field_validator,
    model_validator,
)


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)


class CurrentUser(APIModel):
    id: str
    role: Literal["driver", "shelter_admin", "super_admin"]
    phone_number: str | None = None
    phone_number_verified: bool = False


class ShelterOut(APIModel):
    id: int
    name: str
    address: str
    latitude: float | None
    longitude: float | None
    total_beds: int
    available_beds: int
    food_available: bool
    services: list[str]
    updated_at: datetime


class ShelterUpdate(APIModel):
    model_config = ConfigDict(extra="forbid")

    total_beds: Annotated[StrictInt, Field(ge=0, le=2**63 - 1)] | None = None
    available_beds: Annotated[StrictInt, Field(ge=0, le=2**63 - 1)] | None = None
    food_available: StrictBool | None = None
    services: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]] | None = None

    @field_validator("total_beds", "available_beds", "food_available", "services", mode="before")
    @classmethod
    def reject_explicit_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("Updated values cannot be null")
        return value


class ShelterAssignmentCreate(APIModel):
    model_config = ConfigDict(extra="forbid")

    auth_user_id: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
    shelter_id: Annotated[StrictInt, Field(gt=0, le=2**63 - 1)]


class VehicleInput(APIModel):
    model_config = ConfigDict(extra="forbid")

    make: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100, strict=True)]
    model: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100, strict=True)]
    color: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80, strict=True)]
    license_plate: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40, strict=True)]


class DriverInitialize(APIModel):
    model_config = ConfigDict(extra="forbid")

    sms_notifications_enabled: bool = Field(default=False, strict=True)
    vehicle: VehicleInput


class DriverUpdate(APIModel):
    model_config = ConfigDict(extra="forbid")

    sms_notifications_enabled: bool = Field(strict=True)


class DriverAvailabilityUpdate(APIModel):
    model_config = ConfigDict(extra="forbid")

    is_available: bool = Field(strict=True)


class DriverVerificationUpdate(APIModel):
    model_config = ConfigDict(extra="forbid")

    is_verified: bool = Field(strict=True)


class VehicleOut(APIModel):
    id: int
    make: str
    model: str
    color: str
    license_plate: str


class DriverOut(APIModel):
    id: int
    auth_user_id: str
    phone_number: str
    is_verified: bool
    is_available: bool
    sms_notifications_enabled: bool
    vehicle: VehicleOut | None = None


class RideCreate(APIModel):
    model_config = ConfigDict(extra="forbid")

    first_name: str = Field(min_length=1, max_length=100, strict=True)
    last_name: str = Field(min_length=1, max_length=100, strict=True)
    pickup_latitude: float | None = Field(default=None, ge=-90, le=90, strict=True)
    pickup_longitude: float | None = Field(default=None, ge=-180, le=180, strict=True)
    pickup_address: str | None = Field(default=None, max_length=400, strict=True)
    shelter_id: Annotated[StrictInt, Field(gt=0, le=2**63 - 1)]

    @model_validator(mode="after")
    def validate_pickup_location(self) -> "RideCreate":
        has_latitude = self.pickup_latitude is not None
        has_longitude = self.pickup_longitude is not None
        if has_latitude != has_longitude:
            raise ValueError("pickup_latitude and pickup_longitude must be supplied together")
        if not (has_latitude and has_longitude) and not self.pickup_address:
            raise ValueError("provide a pickup address or both pickup coordinates")
        return self


class RideCreated(APIModel):
    id: int
    status: str
    tracking_token: str


class RidePublicOut(APIModel):
    id: int
    shelter_id: int
    status: str
    created_at: datetime
    accepted_at: datetime | None
    completed_at: datetime | None
    driver_assigned: bool


class DriverRideRequest(APIModel):
    id: int
    pickup_area: str
    shelter_id: int
    shelter_name: str
    status: str
    created_at: datetime


class RideAssignedOut(APIModel):
    id: int
    first_name: str
    last_name: str
    pickup_latitude: float | None
    pickup_longitude: float | None
    pickup_address: str | None
    shelter_id: int
    status: str
    accepted_at: datetime | None


class RideStatusUpdate(APIModel):
    model_config = ConfigDict(extra="forbid")

    # Treat unknown or disallowed transitions as workflow conflicts (409),
    # rather than request-shape errors (422).
    status: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20, strict=True)]
