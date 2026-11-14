"""Application-owned tables from specs/database-spec.md (not Better Auth tables)."""

from datetime import datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Integer, REAL, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Shelter(Base):
    __tablename__ = "shelters"
    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0"),
        CheckConstraint("length(trim(address)) > 0"),
        CheckConstraint("total_beds >= 0"),
        CheckConstraint("available_beds >= 0 AND available_beds <= total_beds"),
        CheckConstraint("latitude IS NULL OR latitude BETWEEN -90 AND 90"),
        CheckConstraint("longitude IS NULL OR longitude BETWEEN -180 AND 180"),
        CheckConstraint("(latitude IS NULL) = (longitude IS NULL)"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    address: Mapped[str] = mapped_column(Text)
    latitude: Mapped[float | None] = mapped_column(REAL)
    longitude: Mapped[float | None] = mapped_column(REAL)
    total_beds: Mapped[int] = mapped_column(server_default=text("0"))
    available_beds: Mapped[int] = mapped_column(server_default=text("0"))
    food_available: Mapped[bool] = mapped_column(Boolean(create_constraint=True), server_default=text("0"))
    # JSON-encoded array; application input validation owns the JSON shape.
    services: Mapped[str] = mapped_column(Text, server_default=text("'[]'"))
    updated_at: Mapped[str] = mapped_column(Text, default=utc_now, onupdate=utc_now)


class ShelterAdmin(Base):
    __tablename__ = "shelter_admins"
    __table_args__ = (
        CheckConstraint("length(trim(auth_user_id)) > 0"),
        UniqueConstraint("auth_user_id", "shelter_id"),
        Index("ix_shelter_admins_shelter_id", "shelter_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    auth_user_id: Mapped[str] = mapped_column(Text)
    shelter_id: Mapped[int] = mapped_column(ForeignKey("shelters.id"))


class Driver(Base):
    __tablename__ = "drivers"
    __table_args__ = (
        CheckConstraint("length(trim(auth_user_id)) > 0"),
        CheckConstraint("length(trim(phone_number)) > 0"),
        CheckConstraint("is_verified = 1 OR is_available = 0"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    auth_user_id: Mapped[str] = mapped_column(Text, unique=True)
    phone_number: Mapped[str] = mapped_column(Text)
    is_verified: Mapped[bool] = mapped_column(Boolean(create_constraint=True), server_default=text("0"))
    is_available: Mapped[bool] = mapped_column(Boolean(create_constraint=True), server_default=text("0"))


class Car(Base):
    __tablename__ = "cars"
    __table_args__ = (
        CheckConstraint("length(trim(make)) > 0"),
        CheckConstraint("length(trim(model)) > 0"),
        CheckConstraint("length(trim(color)) > 0"),
        CheckConstraint("length(trim(license_plate)) > 0"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("drivers.id"), unique=True)
    make: Mapped[str] = mapped_column(Text)
    model: Mapped[str] = mapped_column(Text)
    color: Mapped[str] = mapped_column(Text)
    license_plate: Mapped[str] = mapped_column(Text)


class RideRequest(Base):
    __tablename__ = "ride_requests"
    __table_args__ = (
        CheckConstraint("length(trim(first_name)) > 0"),
        CheckConstraint("length(trim(last_name)) > 0"),
        CheckConstraint("status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')"),
        CheckConstraint("(pickup_latitude IS NULL) = (pickup_longitude IS NULL)"),
        CheckConstraint("pickup_latitude IS NULL OR pickup_latitude BETWEEN -90 AND 90"),
        CheckConstraint("pickup_longitude IS NULL OR pickup_longitude BETWEEN -180 AND 180"),
        CheckConstraint("pickup_latitude IS NOT NULL OR length(trim(coalesce(pickup_address, ''))) > 0"),
        CheckConstraint("status != 'PENDING' OR driver_id IS NULL"),
        CheckConstraint("status NOT IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED') OR driver_id IS NOT NULL"),
        Index("ix_ride_requests_shelter_id", "shelter_id"),
        Index("ix_ride_requests_status_created_at", "status", "created_at"),
        Index("ix_ride_requests_driver_id", "driver_id"),
        Index(
            "ux_ride_requests_one_active_per_driver",
            "driver_id",
            unique=True,
            sqlite_where=text("driver_id IS NOT NULL AND status IN ('ACCEPTED', 'IN_PROGRESS')"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    first_name: Mapped[str] = mapped_column(Text)
    last_name: Mapped[str] = mapped_column(Text)
    pickup_latitude: Mapped[float | None] = mapped_column(REAL)
    pickup_longitude: Mapped[float | None] = mapped_column(REAL)
    pickup_address: Mapped[str | None] = mapped_column(Text)
    shelter_id: Mapped[int] = mapped_column(ForeignKey("shelters.id"))
    driver_id: Mapped[int | None] = mapped_column(ForeignKey("drivers.id"))
    status: Mapped[str] = mapped_column(Text, server_default=text("'PENDING'"))
    created_at: Mapped[str] = mapped_column(Text, default=utc_now)
    accepted_at: Mapped[str | None] = mapped_column(Text)
    completed_at: Mapped[str | None] = mapped_column(Text)
    tracking_token_hash: Mapped[str] = mapped_column(Text, unique=True)
