"""LOCAL DEMO ONLY: verify a driver without exposing an HTTP verification route."""

import argparse
import os

from sqlalchemy import select, text

from shiptohome.database import SessionLocal, initialize_application_tables
from shiptohome.models import Driver


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("auth_user_id", help="Existing driver's Better Auth user ID")
    parser.add_argument("--demo", action="store_true", required=True,
                        help="Confirm this is a disposable local demo database")
    args = parser.parse_args()
    if os.getenv("SHELTERCONNECT_DEMO_MODE") != "1":
        parser.error("set SHELTERCONNECT_DEMO_MODE=1 only for a local demo database")
    initialize_application_tables()
    with SessionLocal() as db:
        db.execute(text("BEGIN IMMEDIATE"))
        driver = db.scalar(select(Driver).where(Driver.auth_user_id == args.auth_user_id))
        if driver is None:
            parser.exit(1, "Driver profile not found.\n")
        driver.is_verified = True
        db.commit()
    print("Demo driver verified. Availability remains unchanged.")


if __name__ == "__main__":
    main()
