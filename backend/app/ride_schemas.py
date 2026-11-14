"""Anonymous ride creation contracts and input validation."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

RequiredText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, strict=True)]
AddressText = Annotated[str, StringConstraints(strip_whitespace=True, strict=True)]


class RideCreateInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: RequiredText
    last_name: RequiredText
    pickup_latitude: float | None = Field(default=None, ge=-90, le=90, strict=True)
    pickup_longitude: float | None = Field(default=None, ge=-180, le=180, strict=True)
    pickup_address: AddressText | None = None
    shelter_id: int = Field(gt=0, strict=True)

    @field_validator("pickup_address")
    @classmethod
    def normalize_address(cls, value: str | None) -> str | None:
        return value or None

    @model_validator(mode="after")
    def validate_pickup(self):
        if (self.pickup_latitude is None) != (self.pickup_longitude is None):
            raise ValueError("pickup_latitude and pickup_longitude must be supplied together")
        if self.pickup_latitude is None and self.pickup_address is None:
            raise ValueError("Provide a pickup address or a coordinate pair")
        return self


class RideCreated(BaseModel):
    id: int
    status: Literal["PENDING"]
    tracking_token: str
