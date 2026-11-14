"""HTTP checks for shared auth roles, driver privacy, and shelter ownership."""

from __future__ import annotations

import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from fastapi import HTTPException, Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from main import app
from shiptohome.auth import get_current_user
from shiptohome.database import Base, get_db
from shiptohome.models import Car, Driver, RideRequest, Shelter, ShelterAdmin
from shiptohome.schemas import CurrentUser


class ApplicationApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory(prefix="shelterconnect-api-")
        self.engine = create_engine(
            f"sqlite:///{Path(self.directory.name) / 'api.sqlite3'}",
            connect_args={"check_same_thread": False, "timeout": 30},
        )
        Base.metadata.create_all(self.engine)
        with self.engine.begin() as connection:
            connection.execute(text('CREATE TABLE "user" (id TEXT PRIMARY KEY, role TEXT NOT NULL)'))
            connection.execute(
                text('INSERT INTO "user" (id, role) VALUES '
                     "('shelter-admin', 'shelter_admin'), ('driver-1', 'driver'), "
                     "('driver-2', 'driver'), ('super-admin', 'super_admin')")
            )
        with Session(self.engine) as db:
            db.add_all(
                [
                    Shelter(
                        id=1,
                        name="Demo One",
                        address="Fictional address",
                        total_beds=10,
                        available_beds=5,
                        services=["Showers"],
                    ),
                    Shelter(
                        id=2,
                        name="Demo Two",
                        address="Fictional address",
                        total_beds=10,
                        available_beds=5,
                        services=[],
                    ),
                    ShelterAdmin(auth_user_id="shelter-admin", shelter_id=1),
                    Driver(
                        id=1,
                        auth_user_id="driver-1",
                        phone_number="+12055550101",
                        is_verified=True,
                        is_available=True,
                        sms_notifications_enabled=True,
                        vehicle=Car(
                            make="Toyota",
                            model="Camry",
                            color="Blue",
                            license_plate="001-ABC",
                        ),
                    ),
                    Driver(
                        id=2,
                        auth_user_id="driver-2",
                        phone_number="+12055550102",
                        is_verified=True,
                        is_available=True,
                        vehicle=Car(
                            make="Honda",
                            model="Civic",
                            color="Silver",
                            license_plate="002-ABC",
                        ),
                    ),
                    RideRequest(
                        id=1,
                        first_name="Private",
                        last_name="Rider",
                        pickup_latitude=33.5207,
                        pickup_longitude=-86.8025,
                        pickup_address="123 Private Street, Unit 5",
                        shelter_id=1,
                        tracking_token_hash="pending-coordinates-token",
                    ),
                    RideRequest(
                        id=2,
                        first_name="Another",
                        last_name="Rider",
                        pickup_address="456 Secret Avenue",
                        shelter_id=1,
                        tracking_token_hash="pending-address-token",
                    ),
                ]
            )
            db.commit()

        self.previous_overrides = app.dependency_overrides.copy()
        app.dependency_overrides[get_db] = self.test_db
        app.dependency_overrides[get_current_user] = self.test_identity
        # Do not enter the TestClient context: that would run startup against the real DB.
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(self.previous_overrides)
        self.engine.dispose()
        self.directory.cleanup()

    def test_db(self) -> Iterator[Session]:
        with Session(self.engine, expire_on_commit=False) as db:
            yield db

    @staticmethod
    def test_identity(request: Request) -> CurrentUser:
        user_id = request.headers.get("X-Test-User")
        if not user_id:
            raise HTTPException(status_code=401)
        return CurrentUser(
            id=user_id,
            role=request.headers.get("X-Test-Role", "driver"),
            phone_number=request.headers.get("X-Test-Phone"),
            phone_number_verified=request.headers.get("X-Test-Phone-Verified") == "true",
        )

    @staticmethod
    def headers(user_id: str, role: str = "driver", **claims: str) -> dict[str, str]:
        headers = {"X-Test-User": user_id, "X-Test-Role": role}
        known_phones = {
            "driver-1": "+12055550101",
            "driver-2": "+12055550102",
        }
        if user_id in known_phones:
            headers["X-Test-Phone"] = known_phones[user_id]
            headers["X-Test-Phone-Verified"] = "true"
        headers.update({f"X-Test-{key}": value for key, value in claims.items()})
        return headers

    def test_driver_list_redacts_pickup_and_active_ride_restores_details(self) -> None:
        headers = self.headers("driver-1")
        response = self.client.get("/api/drivers/requests", headers=headers)
        self.assertEqual(response.status_code, 200)
        pending = {ride["id"]: ride for ride in response.json()}
        self.assertEqual(set(pending), {1, 2})
        serialized = json.dumps(pending)
        self.assertNotIn("Private Street", serialized)
        self.assertNotIn("Secret Avenue", serialized)
        self.assertNotIn("33.5207", serialized)
        self.assertNotIn("Private", serialized)
        self.assertIn("Area 33.5 to 33.6 latitude", pending[1]["pickup_area"])
        self.assertEqual(
            pending[2]["pickup_area"],
            "Address pickup (location details available after acceptance)",
        )

        with Session(self.engine) as db:
            db.add(
                RideRequest(
                    id=3,
                    first_name="Assigned",
                    last_name="Rider",
                    pickup_latitude=33.5207,
                    pickup_longitude=-86.8025,
                    pickup_address="789 Accepted Street",
                    shelter_id=1,
                    driver_id=1,
                    status="ACCEPTED",
                    accepted_at=datetime.now(timezone.utc),
                    tracking_token_hash="accepted-ride-token",
                )
            )
            db.commit()

        self.assertEqual(self.client.get("/api/drivers/requests", headers=headers).json(), [])
        active = self.client.get("/api/drivers/me/active-ride", headers=headers)
        self.assertEqual(active.status_code, 200)
        self.assertEqual(active.json()["pickup_address"], "789 Accepted Street")
        self.assertEqual(active.json()["first_name"], "Assigned")
        self.assertIsNone(
            self.client.get("/api/drivers/me/active-ride", headers=self.headers("driver-2")).json()
        )

    def test_driver_initialization_uses_verified_auth_phone_and_vehicle(self) -> None:
        response = self.client.post(
            "/api/drivers/me/initialize",
            headers=self.headers(
                "new-driver",
                phone="+12055550199",
                **{"Phone-Verified": "true"},
            ),
            json={
                "sms_notifications_enabled": True,
                "vehicle": {
                    "make": "Toyota",
                    "model": "Camry",
                    "color": "Blue",
                    "license_plate": "001-ABC",
                },
            },
        )
        self.assertEqual(response.status_code, 201)
        profile = response.json()
        self.assertEqual(profile["phone_number"], "+12055550199")
        self.assertTrue(profile["sms_notifications_enabled"])
        self.assertEqual(profile["vehicle"]["license_plate"], "001-ABC")

        updated_vehicle = self.client.patch(
            "/api/drivers/me/vehicle",
            headers=self.headers(
                "new-driver",
                phone="+12055550199",
                **{"Phone-Verified": "true"},
            ),
            json={
                "make": "Honda",
                "model": "Civic",
                "color": "Silver",
                "license_plate": "002-ABC",
            },
        )
        self.assertEqual(updated_vehicle.status_code, 200)
        self.assertEqual(updated_vehicle.json()["vehicle"]["license_plate"], "002-ABC")

        spoofed = self.client.post(
            "/api/drivers/me/initialize",
            headers=self.headers("new-driver", phone="+12055550199", **{"Phone-Verified": "true"}),
            json={"phone_number": "+12055550999"},
        )
        self.assertEqual(spoofed.status_code, 422)

    def test_shelter_assignment_checks_target_role_and_updates_are_strict(self) -> None:
        headers = self.headers("super-admin", "super_admin")
        body = {"auth_user_id": "shelter-admin", "shelter_id": 2}
        self.assertEqual(
            self.client.post("/api/admin/shelter-assignments", headers=headers, json=body).status_code,
            201,
        )
        self.assertEqual(
            self.client.post(
                "/api/admin/shelter-assignments",
                headers=headers,
                json=body | {"auth_user_id": "driver-1"},
            ).status_code,
            422,
        )
        self.assertEqual(
            self.client.post(
                "/api/admin/shelter-assignments",
                headers=headers,
                json=body | {"auth_user_id": "missing"},
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.post("/api/admin/shelter-assignments", headers=headers, json=body).status_code,
            409,
        )
        admin_headers = self.headers("shelter-admin", "shelter_admin")
        self.assertEqual(
            self.client.patch(
                "/api/shelters/1", headers=admin_headers, json={"available_beds": 4}
            ).status_code,
            200,
        )
        for invalid in (
            {"available_beds": True},
            {"available_beds": 11},
            {"available_beds": None},
            {"unknown": "field"},
        ):
            with self.subTest(invalid=invalid):
                self.assertEqual(
                    self.client.patch("/api/shelters/1", headers=admin_headers, json=invalid).status_code,
                    422,
                )
        self.assertEqual(
            self.client.patch(
                "/api/shelters/2", headers=admin_headers, json={"available_beds": 3}
            ).status_code,
            403,
        )


if __name__ == "__main__":
    unittest.main()
