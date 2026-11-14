"""End-to-end driver signup and ride-matching flow against main.py's routes."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

import main
from shiptohome import database
from shiptohome.auth import get_current_user
from shiptohome.database import Base, configure_sqlite
from shiptohome.schemas import CurrentUser
from shiptohome.seed import seed_demo_shelters


class DriverFlowTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(prefix="hermes-flow-")
        self.addCleanup(directory.cleanup)
        engine = create_engine(
            f"sqlite:///{Path(directory.name) / 'flow.sqlite3'}",
            connect_args={"check_same_thread": False, "timeout": 30},
        )
        event.listen(engine, "connect", configure_sqlite)
        self.addCleanup(engine.dispose)
        Base.metadata.create_all(engine)
        session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
        with session_factory() as db:
            seed_demo_shelters(db)

        def get_db():
            with session_factory() as db:
                yield db

        self.users: dict[str, CurrentUser] = {}
        self.current = "driver-1"
        main.app.dependency_overrides[database.get_db] = get_db
        main.app.dependency_overrides[main.get_db] = get_db
        main.app.dependency_overrides[get_current_user] = lambda: self.users[self.current]
        self.addCleanup(main.app.dependency_overrides.clear)
        # Background SMS alerts open their own sessions; keep them on this DB.
        for name in ("SessionLocal",):
            patcher = patch.object(main, name, session_factory)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.client = TestClient(main.app)

    def as_user(self, user_id: str, *, phone: str | None = "+12055550100", verified: bool = True):
        self.users[user_id] = CurrentUser(
            id=user_id, role="driver", phone_number=phone, phone_number_verified=verified
        )
        self.current = user_id

    def shelter_id(self, name: str) -> int:
        shelters = self.client.get("/api/shelters").json()
        return next(shelter["id"] for shelter in shelters if shelter["name"] == name)

    def test_signup_requires_verified_phone(self):
        self.as_user("driver-1", phone=None, verified=False)
        response = self.client.post("/api/drivers/me/initialize", json={})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.client.get("/api/drivers/me").status_code, 404)

    def test_unverified_driver_cannot_go_online_without_auto_verify(self):
        self.as_user("driver-1")
        with patch.dict(os.environ, {"DRIVER_AUTO_VERIFY": ""}):
            profile = self.client.post("/api/drivers/me/initialize", json={}).json()
        self.assertFalse(profile["is_verified"])
        response = self.client.patch("/api/drivers/me/availability", json={"is_available": True})
        self.assertEqual(response.status_code, 403)

    def test_rider_finds_a_driver_end_to_end(self):
        # Driver signs up and goes online.
        self.as_user("driver-1")
        with patch.dict(os.environ, {"DRIVER_AUTO_VERIFY": "true"}):
            created = self.client.post(
                "/api/drivers/me/initialize", json={"sms_notifications_enabled": True}
            )
        self.assertEqual(created.status_code, 201, created.text)
        self.assertTrue(created.json()["is_verified"])
        self.assertEqual(created.json()["phone_number"], "+12055550100")
        online = self.client.patch("/api/drivers/me/availability", json={"is_available": True})
        self.assertEqual(online.status_code, 200, online.text)
        self.assertIsNone(self.client.get("/api/drivers/me/active-ride").json())

        # A rider requests a ride without an account.
        shelter_id = self.shelter_id("Downtown Community Shelter")
        with patch.object(main, "send_sms", return_value="sent") as sms:
            ride = self.client.post(
                "/api/rides",
                json={
                    "first_name": "Jordan",
                    "last_name": "Lee",
                    "pickup_address": "1st Ave N & 20th St",
                    "shelter_id": shelter_id,
                },
            )
        self.assertEqual(ride.status_code, 201, ride.text)
        sms.assert_called_once()
        ride_id, token = ride.json()["id"], ride.json()["tracking_token"]
        tracking = {"X-Tracking-Token": token}
        status = self.client.get(f"/api/rides/{ride_id}", headers=tracking).json()
        self.assertEqual(status["status"], "PENDING")
        self.assertFalse(status["driver_assigned"])
        self.assertEqual(status["shelter_name"], "Downtown Community Shelter")

        # The driver sees and accepts it.
        requests = self.client.get("/api/drivers/requests").json()
        self.assertEqual([item["id"] for item in requests], [ride_id])
        accepted = self.client.post(f"/api/rides/{ride_id}/accept")
        self.assertEqual(accepted.status_code, 200, accepted.text)
        self.assertEqual(accepted.json()["shelter_name"], "Downtown Community Shelter")
        self.assertEqual(accepted.json()["first_name"], "Jordan")
        self.assertFalse(self.client.get("/api/drivers/me").json()["is_available"])
        active = self.client.get("/api/drivers/me/active-ride").json()
        self.assertEqual(active["id"], ride_id)

        # A second driver cannot take the same ride.
        self.as_user("driver-2", phone="+12055550111")
        with patch.dict(os.environ, {"DRIVER_AUTO_VERIFY": "true"}):
            self.client.post("/api/drivers/me/initialize", json={})
        self.client.patch("/api/drivers/me/availability", json={"is_available": True})
        self.assertEqual(self.client.get("/api/drivers/requests").json(), [])
        self.assertEqual(self.client.post(f"/api/rides/{ride_id}/accept").status_code, 409)

        # The rider sees a driver is assigned; the first driver completes it.
        status = self.client.get(f"/api/rides/{ride_id}", headers=tracking).json()
        self.assertEqual(status["status"], "ACCEPTED")
        self.assertTrue(status["driver_assigned"])
        self.as_user("driver-1")
        for next_status in ("IN_PROGRESS", "COMPLETED"):
            response = self.client.patch(f"/api/rides/{ride_id}/status", json={"status": next_status})
            self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            self.client.get(f"/api/rides/{ride_id}", headers=tracking).json()["status"], "COMPLETED"
        )
        self.assertIsNone(self.client.get("/api/drivers/me/active-ride").json())
        self.assertTrue(self.client.get("/api/drivers/me").json()["is_available"])


if __name__ == "__main__":
    unittest.main()
