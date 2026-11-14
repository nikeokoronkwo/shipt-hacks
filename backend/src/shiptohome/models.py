from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from shiptohome.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Shelter(Base):
    __tablename__ = "shelters"
    __table_args__ = (
        CheckConstraint("total_beds >= 0", name="ck_shelters_total_beds_nonnegative"),
        CheckConstraint(
            "available_beds >= 0 AND available_beds <= total_beds",
            name="ck_shelters_available_beds_range",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str] = mapped_column(String(400), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_beds: Mapped[int] = mapped_column(Integer, nullable=False)
    available_beds: Mapped[int] = mapped_column(Integer, nullable=False)
    food_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    services: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    admins: Mapped[list["ShelterAdmin"]] = relationship(
        back_populates="shelter", cascade="all, delete-orphan"
    )
    rides: Mapped[list["RideRequest"]] = relationship(back_populates="shelter")


class ShelterAdmin(Base):
    __tablename__ = "shelter_admins"
    __table_args__ = (
        UniqueConstraint("auth_user_id", "shelter_id", name="uq_shelter_admin_assignment"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Do not use a foreign key to Better Auth's user table: that schema is
    # independently migrated and owned by Better Auth.
    auth_user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    shelter_id: Mapped[int] = mapped_column(
        ForeignKey("shelters.id", ondelete="CASCADE"), nullable=False, index=True
    )

    shelter: Mapped[Shelter] = relationship(back_populates="admins")


class Driver(Base):
    __tablename__ = "drivers"
    __table_args__ = (
        CheckConstraint("is_verified IN (0, 1)", name="ck_drivers_verified_boolean"),
        CheckConstraint("is_available IN (0, 1)", name="ck_drivers_available_boolean"),
        CheckConstraint(
            "sms_notifications_enabled IN (0, 1)",
            name="ck_drivers_sms_notifications_boolean",
        ),
        CheckConstraint("is_verified = 1 OR is_available = 0", name="ck_drivers_verified_before_online"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    auth_user_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    phone_number: Mapped[str] = mapped_column(String(32), nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sms_notifications_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    rides: Mapped[list["RideRequest"]] = relationship(back_populates="driver")
    vehicle: Mapped["Car | None"] = relationship(
        back_populates="driver", cascade="all, delete-orphan", uselist=False
    )


class Car(Base):
    """At most one registered vehicle per driver."""

    __tablename__ = "cars"
    __table_args__ = (
        CheckConstraint("length(trim(make)) > 0", name="ck_cars_make_nonblank"),
        CheckConstraint("length(trim(model)) > 0", name="ck_cars_model_nonblank"),
        CheckConstraint("length(trim(color)) > 0", name="ck_cars_color_nonblank"),
        CheckConstraint("length(trim(license_plate)) > 0", name="ck_cars_plate_nonblank"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    driver_id: Mapped[int] = mapped_column(
        ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    make: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(80), nullable=False)
    license_plate: Mapped[str] = mapped_column(String(40), nullable=False)

    driver: Mapped[Driver] = relationship(back_populates="vehicle")


class RideRequest(Base):
    __tablename__ = "ride_requests"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')",
            name="ck_ride_requests_status",
        ),
        Index(
            "uq_driver_one_active_ride",
            "driver_id",
            unique=True,
            sqlite_where=text("driver_id IS NOT NULL AND status IN ('ACCEPTED', 'IN_PROGRESS')"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    pickup_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    pickup_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    pickup_address: Mapped[str | None] = mapped_column(String(400), nullable=True)
    shelter_id: Mapped[int] = mapped_column(ForeignKey("shelters.id"), nullable=False, index=True)
    driver_id: Mapped[int | None] = mapped_column(ForeignKey("drivers.id"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    tracking_token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)

    shelter: Mapped[Shelter] = relationship(back_populates="rides")
    driver: Mapped[Driver | None] = relationship(back_populates="rides")
