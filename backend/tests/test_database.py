"""Exercise the real SQLite schema, including writes outside the ORM."""

import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import Base, configure_sqlite, init_db
from app.models import Car, Driver, RideRequest, Shelter, ShelterAdmin


class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.engine = create_engine(f"sqlite:///{Path(self.directory.name) / 'test.db'}")
        event.listen(self.engine, "connect", configure_sqlite)
        with patch("app.database.engine", self.engine):
            init_db()
            init_db()  # Startup is idempotent.
        with Session(self.engine) as session:
            session.add_all([
                Shelter(id=1, name="Demo shelter", address="Demo address"),
                Driver(id=1, auth_user_id="driver", phone_number="001-555-0100", is_verified=True),
            ])
            session.commit()

    def tearDown(self):
        self.engine.dispose()
        self.directory.cleanup()

    def test_tables_indexes_and_connection_settings(self):
        inspector = inspect(self.engine)
        self.assertEqual(set(inspector.get_table_names()), {
            "shelters", "shelter_admins", "drivers", "cars", "ride_requests",
        })
        self.assertEqual(set(Base.metadata.tables), set(inspector.get_table_names()))
        self.assertEqual({index["name"] for index in inspector.get_indexes("ride_requests")}, {
            "ix_ride_requests_shelter_id", "ix_ride_requests_status_created_at",
            "ix_ride_requests_driver_id", "ux_ride_requests_one_active_per_driver",
        })
        for _ in range(2):
            with self.engine.connect() as connection:
                for pragma, expected in [("foreign_keys", 1), ("busy_timeout", 30000), ("journal_mode", "wal")]:
                    self.assertEqual(connection.exec_driver_sql(f"PRAGMA {pragma}").scalar(), expected)
            self.engine.dispose()

    def test_defaults_utc_timestamps_and_shelter_updates(self):
        with Session(self.engine) as session:
            shelter = session.get(Shelter, 1)
            self.assertEqual((shelter.total_beds, shelter.available_beds, shelter.services), (0, 0, "[]"))
            self.assertFalse(shelter.food_available)
            self.assertIsNotNone(datetime.fromisoformat(shelter.updated_at).tzinfo)
            before = shelter.updated_at
            shelter.name = "Updated demo shelter"
            ride = RideRequest(first_name="Demo", last_name="Rider", pickup_address="Demo pickup", shelter_id=1, tracking_token_hash="hash")
            driver = Driver(auth_user_id="new-driver", phone_number="001-555-0101")
            session.add_all([ride, driver])
            session.commit()
            self.assertNotEqual(shelter.updated_at, before)
            self.assertEqual(ride.status, "PENDING")
            self.assertIsNotNone(datetime.fromisoformat(ride.created_at).tzinfo)
            self.assertFalse(driver.is_available)
            self.assertFalse(driver.is_verified)
            self.assertEqual(driver.phone_number, "001-555-0101")

    def test_shelter_and_driver_constraints(self):
        invalid_updates = [
            "UPDATE shelters SET name = ' '",
            "UPDATE shelters SET address = ' '",
            "UPDATE shelters SET total_beds = -1",
            "UPDATE shelters SET available_beds = -1",
            "UPDATE shelters SET available_beds = 1",
            "UPDATE shelters SET food_available = 2",
            "UPDATE shelters SET latitude = 1",
            "UPDATE shelters SET latitude = 91, longitude = 1",
            "UPDATE shelters SET latitude = 1, longitude = -181",
            "UPDATE drivers SET auth_user_id = ' '",
            "UPDATE drivers SET phone_number = ' '",
            "UPDATE drivers SET is_verified = 2",
            "UPDATE drivers SET is_available = 2",
            "UPDATE drivers SET is_verified = 0, is_available = 1",
            "INSERT INTO drivers (auth_user_id, phone_number) VALUES ('driver', '001')",
        ]
        for sql in invalid_updates:
            with self.subTest(sql=sql), self.assertRaises(IntegrityError):
                with self.engine.begin() as connection:
                    connection.exec_driver_sql(sql)

    def insert_ride(self, **overrides):
        values = dict(first_name="Demo", last_name="Rider", pickup_address="Demo pickup", shelter_id=1, tracking_token_hash="hash", created_at="2026-01-01T00:00:00+00:00")
        values.update(overrides)
        with self.engine.begin() as connection:
            connection.execute(RideRequest.__table__.insert().values(**values))

    def test_ride_constraints(self):
        invalid_values = [
            {"first_name": " "}, {"last_name": " "}, {"pickup_address": None},
            {"pickup_address": " "}, {"pickup_latitude": 1}, {"pickup_longitude": 1},
            {"pickup_latitude": 91, "pickup_longitude": 1},
            {"pickup_latitude": 1, "pickup_longitude": 181},
            {"shelter_id": 999}, {"shelter_id": None}, {"status": "UNKNOWN"},
            {"driver_id": 1}, {"status": "ACCEPTED"}, {"status": "IN_PROGRESS"},
            {"status": "COMPLETED"}, {"status": "ACCEPTED", "driver_id": 999},
            {"tracking_token_hash": None},
        ]
        for values in invalid_values:
            with self.subTest(values=values), self.assertRaises(IntegrityError):
                self.insert_ride(**values)
        self.insert_ride(pickup_address=None, pickup_latitude=0, pickup_longitude=0)
        with self.assertRaises(IntegrityError):
            self.insert_ride()  # Duplicate token hash.

    def test_active_ride_uniqueness_and_history(self):
        self.insert_ride(status="ACCEPTED", driver_id=1)
        for status in ("ACCEPTED", "IN_PROGRESS"):
            with self.subTest(status=status), self.assertRaises(IntegrityError):
                self.insert_ride(status=status, driver_id=1, tracking_token_hash="second")
        with self.engine.begin() as connection:
            connection.execute(text("UPDATE ride_requests SET status = 'COMPLETED'"))
        self.insert_ride(status="IN_PROGRESS", driver_id=1, tracking_token_hash="second")
        for table in ("drivers", "shelters"):
            with self.subTest(table=table), self.assertRaises(IntegrityError):
                with self.engine.begin() as connection:
                    connection.exec_driver_sql(f"DELETE FROM {table} WHERE id = 1")

    def test_car_required_fields_and_driver_reference(self):
        valid = dict(driver_id=1, make="Toyota", model="Camry", color="Blue", license_plate="001-ABC")
        invalid = [{"driver_id": None}, {"driver_id": 999}]
        for field in ("make", "model", "color", "license_plate"):
            invalid.extend([{field: None}, {field: ""}, {field: "   "}])
        for overrides in invalid:
            with self.subTest(overrides=overrides), self.assertRaises(IntegrityError):
                with self.engine.begin() as connection:
                    connection.execute(Car.__table__.insert().values(**(valid | overrides)))

    def test_one_car_per_driver_and_updates(self):
        with Session(self.engine) as session:
            car = Car(driver_id=1, make="Toyota", model="Camry", color="Blue", license_plate="001-ABC")
            session.add(car)
            session.commit()
            self.assertEqual(car.license_plate, "001-ABC")
            car.color = "Silver"
            session.commit()
            session.refresh(car)
            self.assertEqual(car.color, "Silver")
        with self.assertRaises(IntegrityError):
            with self.engine.begin() as connection:
                connection.execute(Car.__table__.insert().values(
                    driver_id=1, make="Honda", model="Civic", color="Red", license_plate="002-ABC",
                ))
        with self.assertRaises(IntegrityError):
            with self.engine.begin() as connection:
                connection.exec_driver_sql("DELETE FROM drivers WHERE id = 1")
        with self.engine.begin() as connection:
            connection.exec_driver_sql("DELETE FROM cars WHERE driver_id = 1")
        with Session(self.engine) as session:
            self.assertIsNotNone(session.get(Driver, 1))

    def test_admin_assignments(self):
        with self.engine.begin() as connection:
            connection.execute(ShelterAdmin.__table__.insert().values(auth_user_id="admin", shelter_id=1))
        for user, shelter in [("admin", 1), (" ", 1), ("other", 999)]:
            with self.subTest(user=user, shelter=shelter), self.assertRaises(IntegrityError):
                with self.engine.begin() as connection:
                    connection.execute(ShelterAdmin.__table__.insert().values(auth_user_id=user, shelter_id=shelter))
        with self.assertRaises(IntegrityError):
            with self.engine.begin() as connection:
                connection.exec_driver_sql("DELETE FROM shelters WHERE id = 1")


if __name__ == "__main__":
    unittest.main()
