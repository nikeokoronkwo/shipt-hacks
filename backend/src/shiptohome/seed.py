from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from shiptohome.models import Shelter


DEMO_SHELTERS = [
    {
        "name": "Five Points Welcome Center",
        "address": "1820 11th Avenue South, Birmingham, AL",
        "latitude": 33.5015,
        "longitude": -86.8007,
        "total_beds": 48,
        "available_beds": 12,
        "food_available": True,
        "services": ["Hot meals", "Showers", "Laundry"],
    },
    {
        "name": "Northside Night Shelter",
        "address": "501 43rd Street North, Birmingham, AL",
        "latitude": 33.5445,
        "longitude": -86.8123,
        "total_beds": 35,
        "available_beds": 5,
        "food_available": True,
        "services": ["Dinner", "Case management", "Storage"],
    },
    {
        "name": "East Lake Family Resource Hub",
        "address": "7401 1st Avenue North, Birmingham, AL",
        "latitude": 33.5608,
        "longitude": -86.7354,
        "total_beds": 24,
        "available_beds": 8,
        "food_available": False,
        "services": ["Family rooms", "Child care referrals", "Clothing"],
    },
]


def seed_demo_shelters(db: Session) -> None:
    """Seed clearly labelled demo records once, without touching auth tables."""
    if db.scalar(select(Shelter.id).limit(1)) is not None:
        return
    db.add_all(Shelter(**shelter) for shelter in DEMO_SHELTERS)
    db.commit()
