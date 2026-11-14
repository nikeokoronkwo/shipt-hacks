"""Send one test SMS: python scripts/send_test_sms.py +15551234567"""

import sys

from shiptohome.sms import send_sms


if len(sys.argv) != 2:
    raise SystemExit("Usage: python scripts/send_test_sms.py +15551234567")

result = send_sms(
    sys.argv[1],
    "ShelterConnect test message. Reply STOP to stop all ShelterConnect texts.",
)
if result != "sent":
    raise SystemExit(f"SMS was not sent: {result}")
print("SMS sent successfully.")
