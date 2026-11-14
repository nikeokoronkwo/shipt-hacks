from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser, require_role
from app.database import get_db
from app.shelters import service
from app.shelters.schemas import AssignmentCreate, AssignmentOut, ShelterOut, ShelterPatch

router = APIRouter(prefix="/api", tags=["shelters"])
admin = require_role("shelter_admin", "super_admin")


@router.get("/shelters", response_model=list[ShelterOut])
def list_public(db: Session = Depends(get_db)):
    return service.list_shelters(db)


@router.get("/shelters/{id}", response_model=ShelterOut)
def detail(id: int, db: Session = Depends(get_db)):
    return service.get_shelter(db, id)


@router.patch("/shelters/{id}", response_model=ShelterOut)
def update(id: int, changes: ShelterPatch, user: CurrentUser = Depends(admin), db: Session = Depends(get_db)):
    return service.update_shelter(db, id, changes, user)


@router.get("/admin/shelters", response_model=list[ShelterOut])
def list_admin(user: CurrentUser = Depends(admin), db: Session = Depends(get_db)):
    return service.list_shelters(db, user)


@router.post("/admin/shelter-assignments", response_model=AssignmentOut, status_code=201)
def assign(values: AssignmentCreate, user: CurrentUser = Depends(require_role("super_admin")), db: Session = Depends(get_db)):
    return service.create_assignment(db, values)
