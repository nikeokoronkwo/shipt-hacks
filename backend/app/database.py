"""SQLite connection setup shared by application models and routes."""

import os
from collections.abc import Generator

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./shelterconnect.db")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 30},
)


@event.listens_for(engine, "connect")
def configure_sqlite(connection, _):
    cursor = connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.execute("PRAGMA journal_mode=WAL")
    finally:
        cursor.close()


SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session


def init_db() -> None:
    # Register application models before creating missing tables. Auth owns its schema.
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    # create_all does not add columns to tables that already exist.
    with engine.begin() as connection:
        driver_columns = {column["name"] for column in inspect(connection).get_columns("drivers")}
        if "sms_opted_in" not in driver_columns:
            connection.execute(text(
                "ALTER TABLE drivers ADD COLUMN sms_opted_in BOOLEAN NOT NULL DEFAULT 0"
            ))
