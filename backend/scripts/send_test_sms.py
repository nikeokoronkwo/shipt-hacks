"""Send one test SMS: python scripts/send_test_sms.py +14703300803"""

import os
import sys

from app.notifications import send_ride_request_sms


if len(sys.argv) != 2:
    raise SystemExit("Usage: python scripts/send_test_sms.py +15551234567")

sid = send_ride_request_sms(
    phone_number=sys.argv[1],
    ride_id=123,
    base_url=os.getenv("FRONTEND_URL", "http://localhost:3000"),
)
print(f"SMS sent successfully: {sid}")
