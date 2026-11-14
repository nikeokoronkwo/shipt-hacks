import json
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, StringConstraints, field_validator

Nonblank = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Beds = Annotated[StrictInt, Field(ge=0, le=2**63 - 1)]


class ShelterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    address: str
    latitude: float | None
    longitude: float | None
    total_beds: int
    available_beds: int
    food_available: bool
    services: list[str]
    updated_at: str

    @field_validator("services", mode="before")
    @classmethod
    def decode_services(cls, value):
        return json.loads(value) if isinstance(value, str) else value


class ShelterPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    total_beds: Beds | None = None
    available_beds: Beds | None = None
    food_available: StrictBool | None = None
    services: list[Nonblank] | None = None

    @field_validator("total_beds", "available_beds", "food_available", "services", mode="before")
    @classmethod
    def reject_null(cls, value):
        if value is None:
            raise ValueError("Updated values cannot be null")
        return value


class AssignmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    auth_user_id: Nonblank
    shelter_id: Annotated[StrictInt, Field(gt=0, le=2**63 - 1)]


class AssignmentOut(AssignmentCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
