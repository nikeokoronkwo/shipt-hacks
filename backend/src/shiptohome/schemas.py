from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


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
    total_beds: int | None = Field(default=None, ge=0)
    available_beds: int | None = Field(default=None, ge=0)
    food_available: bool | None = None
    services: list[str] | None = None


class ShelterAssignmentCreate(APIModel):
    auth_user_id: str = Field(min_length=1, max_length=64)
    shelter_id: int = Field(gt=0)


class DriverInitialize(APIModel):
    sms_notifications_enabled: bool = False


class DriverUpdate(APIModel):
    sms_notifications_enabled: bool


class DriverAvailabilityUpdate(APIModel):
    is_available: bool


class DriverVerificationUpdate(APIModel):
    is_verified: bool


class DriverOut(APIModel):
    id: int
    auth_user_id: str
    phone_number: str
    is_verified: bool
    is_available: bool
    sms_notifications_enabled: bool


class RideCreate(APIModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    pickup_latitude: float | None = None
    pickup_longitude: float | None = None
    pickup_address: str | None = Field(default=None, max_length=400)
    shelter_id: int = Field(gt=0)

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
    status: Literal["IN_PROGRESS", "COMPLETED", "CANCELLED"]
