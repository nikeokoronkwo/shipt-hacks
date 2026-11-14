"""Idempotent fictional Birmingham demo data. Run: python -m app.seed."""
import json
from pathlib import Path

from sqlalchemy import select, text

from app.database import SessionLocal, init_db
from app.models import Shelter, ShelterAdmin

DEMO_SHELTERS = [
    ("Demo Downtown Shelter", "Fictional site near Downtown, Birmingham, AL", 33.5186, -86.8104, 50, 12, True, ["Showers", "Laundry"]),
    ("Demo Five Points Shelter", "Fictional site near Five Points South, Birmingham, AL", 33.4969, -86.7966, 30, 7, True, ["Meals", "Clothing"]),
    ("Demo Avondale Shelter", "Fictional site near Avondale, Birmingham, AL", 33.5240, -86.7740, 25, 0, False, ["Showers"]),
    ("Demo West End Shelter", "Fictional site near West End, Birmingham, AL", 33.4850, -86.8680, 40, 15, True, ["Meals", "Laundry"]),
]


def seed_demo():
    credentials = Path(__file__).resolve().parents[2] / ".demo-credentials.json"
    if not credentials.exists():
        raise RuntimeError("Run auth's npm run seed-demo first")
    accounts = json.loads(credentials.read_text())
    admin_id = next(account["id"] for account in accounts if account["role"] == "shelter_admin")
    init_db()
    with SessionLocal() as db:
        db.execute(text("BEGIN IMMEDIATE"))
        if db.execute(text('SELECT role FROM "user" WHERE id = :id'), {"id": admin_id}).scalar() != "shelter_admin":
            raise RuntimeError("Demo shelter administrator is missing from this database")
        shelters = []
        for name, address, lat, lon, total, available, food, services in DEMO_SHELTERS:
            shelter = db.scalar(select(Shelter).where(Shelter.name == name, Shelter.address == address))
            if shelter is None:
                shelter = Shelter(name=name, address=address, latitude=lat, longitude=lon,
                                  total_beds=total, available_beds=available, food_available=food,
                                  services=json.dumps(services))
                db.add(shelter)
                db.flush()
            shelters.append(shelter)
        if db.scalar(select(ShelterAdmin.id).where(
            ShelterAdmin.auth_user_id == admin_id, ShelterAdmin.shelter_id == shelters[0].id,
        )) is None:
            db.add(ShelterAdmin(auth_user_id=admin_id, shelter_id=shelters[0].id))
        db.commit()
    print("Four fictional demo shelters ready; demo administrator assigned to Downtown. Availability is demonstration data.")


if __name__ == "__main__":
    seed_demo()
