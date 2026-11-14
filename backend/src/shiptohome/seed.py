from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from shiptohome.models import Shelter


# Fictional Birmingham fixtures. Names must stay in sync with
# frontend/lib/demo-data.ts: the shelter pages resolve live records by name.
DEMO_SHELTERS = [
    {
        "name": "Downtown Community Shelter",
        "address": "Downtown, Birmingham, AL",
        "latitude": 33.516,
        "longitude": -86.809,
        "total_beds": 40,
        "available_beds": 12,
        "food_available": True,
        "services": ["ADA Accessible", "Meals"],
    },
    {
        "name": "Northside Welcome Center",
        "address": "Northside, Birmingham, AL",
        "latitude": 33.531,
        "longitude": -86.815,
        "total_beds": 30,
        "available_beds": 8,
        "food_available": True,
        "services": ["ADA Accessible", "Meals"],
    },
    {
        "name": "Southside Community House",
        "address": "Southside, Birmingham, AL",
        "latitude": 33.501,
        "longitude": -86.797,
        "total_beds": 20,
        "available_beds": 5,
        "food_available": True,
        "services": ["Women Only", "Meals"],
    },
    {
        "name": "Avondale Family Shelter",
        "address": "Avondale, Birmingham, AL",
        "latitude": 33.525,
        "longitude": -86.774,
        "total_beds": 36,
        "available_beds": 15,
        "food_available": False,
        "services": ["Pet Friendly", "Family Units", "ADA Accessible"],
    },
    {
        "name": "Eastside Safe Rest",
        "address": "East Lake, Birmingham, AL",
        "latitude": 33.556,
        "longitude": -86.747,
        "total_beds": 18,
        "available_beds": 0,
        "food_available": False,
        "services": ["Pet Friendly"],
    },
]


def seed_demo_shelters(db: Session) -> None:
    """Add any missing demo shelters by name, without touching auth tables.

    Existing rows are never overwritten, so shelter admins' bed counts survive
    restarts and older local databases simply gain the newer fixtures.
    """
    existing = set(db.scalars(select(Shelter.name)))
    missing = [shelter for shelter in DEMO_SHELTERS if shelter["name"] not in existing]
    if not missing:
        return
    db.add_all(Shelter(**shelter) for shelter in missing)
    db.commit()
