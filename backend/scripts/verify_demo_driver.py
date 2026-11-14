"""LOCAL DEMO ONLY: verify a driver without exposing an HTTP verification route."""

import argparse

from app.database import SessionLocal
from app.driver_service import DriverWorkflowError, get_profile, serialized_write


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("auth_user_id", help="Existing driver's Better Auth user ID")
    parser.add_argument("--demo", action="store_true", required=True,
                        help="Confirm this is a disposable local demo database")
    args = parser.parse_args()
    try:
        with SessionLocal() as db, serialized_write(db):
            driver = get_profile(db, args.auth_user_id)
            driver.is_verified = True
    except DriverWorkflowError as exc:
        parser.exit(1, f"{exc.detail}\n")
    print("Demo driver verified. Availability remains unchanged.")


if __name__ == "__main__":
    main()
