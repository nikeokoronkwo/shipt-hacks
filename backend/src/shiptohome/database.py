"""The application-owned portion of the shared SQLite database.

Better Auth has exclusive ownership of ``user``, ``session``, ``account``,
``verification``, and ``jwks``.  SQLAlchemy only ever creates the tables
declared from this module's Base, so neither migration system modifies the
other's schema.
"""

from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import Engine, event, inspect, text
from sqlalchemy.engine import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_DATABASE_PATH = PROJECT_ROOT / "data" / "shelterconnect.sqlite3"
DEFAULT_DATABASE_URL = f"sqlite:///{DEFAULT_DATABASE_PATH}"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)


def _ensure_database_directory() -> None:
    """Create the parent folder for a file-backed SQLite URL."""
    if not DATABASE_URL.startswith("sqlite:///"):
        return
    database_path = DATABASE_URL.removeprefix("sqlite:///")
    if database_path not in {"", ":memory:"}:
        Path(database_path).expanduser().parent.mkdir(parents=True, exist_ok=True)


_ensure_database_directory()

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 30},
    pool_pre_ping=True,
)


@event.listens_for(Engine, "connect")
def configure_sqlite(dbapi_connection: object, _connection_record: object) -> None:
    """Use the same SQLite concurrency settings as the Node auth process."""
    # These PRAGMAs are SQLite-specific. The project intentionally uses SQLite,
    # but retaining this guard makes an eventual database migration less noisy.
    module_name = type(dbapi_connection).__module__
    if not module_name.startswith("sqlite3"):
        return
    cursor = dbapi_connection.cursor()  # type: ignore[union-attr]
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.execute("PRAGMA busy_timeout = 30000")
    cursor.execute("PRAGMA synchronous = NORMAL")
    cursor.close()


class Base(DeclarativeBase):
    """Declarative base for application tables only."""


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def initialize_application_tables() -> None:
    """Create only FastAPI-owned tables; never migrate Better Auth tables."""
    # Importing registers models with Base before create_all executes.
    from shiptohome import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    # create_all intentionally does not change existing tables. Keep the small
    # application-owned schema upgrade explicit and idempotent.
    driver_columns = {column["name"] for column in inspect(engine).get_columns("drivers")}
    missing_driver_columns = {
        "sms_notifications_enabled": "BOOLEAN NOT NULL DEFAULT 0",
        "vehicle_make": "VARCHAR(80) NOT NULL DEFAULT ''",
        "vehicle_model": "VARCHAR(80) NOT NULL DEFAULT ''",
        "vehicle_color": "VARCHAR(40) NOT NULL DEFAULT ''",
        "license_plate": "VARCHAR(32) NOT NULL DEFAULT ''",
    }
    with engine.begin() as connection:
        for column, definition in missing_driver_columns.items():
            if column not in driver_columns:
                connection.execute(text(f"ALTER TABLE drivers ADD COLUMN {column} {definition}"))
