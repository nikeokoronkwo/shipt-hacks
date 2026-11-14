"""Checks for SQLite settings and the SQLAlchemy-owned application tables."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from shiptohome import database, models  # noqa: F401


class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="shelterconnect-db-")
        db_path = Path(self.directory.name) / "test.sqlite3"
        self.engine = create_engine(
            f"sqlite:///{db_path}",
            connect_args={"check_same_thread": False, "timeout": 30},
        )
        with patch.object(database, "engine", self.engine):
            database.initialize_application_tables()
            database.initialize_application_tables()  # Startup is idempotent.
        with Session(self.engine) as session:
            session.add_all(
                [
                    models.Shelter(
                        name="Demo shelter",
                        address="Demo address",
                        total_beds=10,
                        available_beds=4,
                        food_available=False,
                        services=[],
                    ),
                    models.Driver(
                        auth_user_id="driver-1",
                        phone_number="+12055550100",
                        is_verified=True,
                        is_available=True,
                    ),
                ]
            )
            session.commit()

    def tearDown(self):
        self.engine.dispose()
        self.directory.cleanup()

    def test_application_owns_only_domain_tables(self):
        inspector = inspect(self.engine)
        tables = set(inspector.get_table_names())
        self.assertEqual(tables, {"shelters", "shelter_admins", "drivers", "ride_requests"})
        self.assertNotIn("user", tables)
        self.assertIn("sms_notifications_enabled", {
            column["name"] for column in inspector.get_columns("drivers")
        })

    def test_sqlite_connections_match_auth_writer_settings(self):
        with self.engine.connect() as connection:
            self.assertEqual(connection.exec_driver_sql("PRAGMA foreign_keys").scalar(), 1)
            self.assertEqual(connection.exec_driver_sql("PRAGMA busy_timeout").scalar(), 30000)
            self.assertEqual(connection.exec_driver_sql("PRAGMA journal_mode").scalar(), "wal")

    def test_bed_and_active_ride_constraints(self):
        with self.engine.begin() as connection:
            with self.assertRaises(IntegrityError):
                connection.exec_driver_sql(
                    "UPDATE shelters SET available_beds = 11 WHERE id = 1"
                )

        with Session(self.engine) as session:
            session.add(
                models.RideRequest(
                    first_name="Demo",
                    last_name="Rider",
                    pickup_address="Demo pickup",
                    shelter_id=1,
                    driver_id=1,
                    status="ACCEPTED",
                    tracking_token_hash="first-token-hash",
                )
            )
            session.commit()
            session.add(
                models.RideRequest(
                    first_name="Second",
                    last_name="Rider",
                    pickup_address="Second pickup",
                    shelter_id=1,
                    driver_id=1,
                    status="IN_PROGRESS",
                    tracking_token_hash="second-token-hash",
                )
            )
            with self.assertRaises(IntegrityError):
                session.commit()
            session.rollback()


if __name__ == "__main__":
    unittest.main()
