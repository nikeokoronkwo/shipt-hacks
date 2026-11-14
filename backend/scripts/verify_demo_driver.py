"""LOCAL DEMO ONLY: verify a driver without exposing an HTTP verification route.

Run from backend/ after loading the shared .env:

    uv run python scripts/verify_demo_driver.py <better-auth-user-id> --demo
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from sqlalchemy import select  # noqa: E402

from shiptohome.database import SessionLocal, initialize_application_tables  # noqa: E402
from shiptohome.models import Driver  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("auth_user_id", help="Existing driver's Better Auth user ID")
    parser.add_argument("--demo", action="store_true", required=True,
                        help="Confirm this is a disposable local demo database")
    args = parser.parse_args()
    initialize_application_tables()
    with SessionLocal() as db:
        driver = db.scalar(select(Driver).where(Driver.auth_user_id == args.auth_user_id))
        if driver is None:
            parser.exit(1, "No driver profile exists for that user. Finish driver setup first.\n")
        driver.is_verified = True
        db.commit()
    print("Demo driver verified. Availability remains unchanged.")


if __name__ == "__main__":
    main()
