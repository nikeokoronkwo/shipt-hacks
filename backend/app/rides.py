"""Thin public HTTP route for anonymous transportation requests."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.ride_schemas import RideCreated, RideCreateInput
from app.ride_service import create_ride

router = APIRouter(prefix="/api", tags=["rides"])


@router.post("/rides", response_model=RideCreated, status_code=201,
             description="Create an anonymous ride request. Reported beds are not a reservation or confirmed admission. Save the private tracking token: it is returned only once.")
def request_ride(body: RideCreateInput, response: Response,
                 db: Annotated[Session, Depends(get_db)]):
    response.headers["Cache-Control"] = "no-store"
    return create_ride(db, **body.model_dump())
