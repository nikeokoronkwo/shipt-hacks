import json

from fastapi import HTTPException
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser
from app.models import Shelter, ShelterAdmin, utc_now
from app.shelters.schemas import AssignmentCreate, ShelterPatch


def get_shelter(db: Session, shelter_id: int) -> Shelter:
    if not 0 < shelter_id < 2**63:
        raise HTTPException(404, "Shelter not found")
    shelter = db.get(Shelter, shelter_id)
    if shelter is None:
        raise HTTPException(404, "Shelter not found")
    return shelter


def list_shelters(db: Session, user: CurrentUser | None = None):
    query = select(Shelter).order_by(Shelter.id)
    if user is not None and user.role != "super_admin":
        query = query.join(ShelterAdmin).where(ShelterAdmin.auth_user_id == user.id)
    return db.scalars(query).all()


def update_shelter(db: Session, shelter_id: int, changes: ShelterPatch, user: CurrentUser):
    # Serialize capacity checks and writes across SQLite connections.
    db.execute(text("BEGIN IMMEDIATE"))
    shelter = get_shelter(db, shelter_id)
    if user.role != "super_admin" and db.scalar(select(ShelterAdmin.id).where(
        ShelterAdmin.auth_user_id == user.id, ShelterAdmin.shelter_id == shelter_id,
    )) is None:
        raise HTTPException(403, "Shelter is not assigned to this administrator")
    values = changes.model_dump(exclude_unset=True)
    if values.get("available_beds", shelter.available_beds) > values.get("total_beds", shelter.total_beds):
        raise HTTPException(422, "Available beds cannot exceed total beds")
    if "services" in values:
        values["services"] = json.dumps(values["services"])
    for key, value in values.items():
        setattr(shelter, key, value)
    shelter.updated_at = utc_now()
    db.commit()
    db.refresh(shelter)
    return shelter


def create_assignment(db: Session, values: AssignmentCreate):
    db.execute(text("BEGIN IMMEDIATE"))
    get_shelter(db, values.shelter_id)
    # Read identity/role only; Better Auth exclusively owns writes to this table.
    if not inspect(db.connection()).has_table("user"):
        raise HTTPException(503, "Initialize the Better Auth database first")
    role = db.execute(text('SELECT role FROM "user" WHERE id = :id'), {"id": values.auth_user_id}).scalar_one_or_none()
    if role is None:
        raise HTTPException(404, "Auth user not found")
    if role != "shelter_admin":
        raise HTTPException(422, "Assignment requires a shelter_admin account")
    assignment = ShelterAdmin(**values.model_dump())
    db.add(assignment)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Shelter assignment already exists") from None
    db.refresh(assignment)
    return assignment
