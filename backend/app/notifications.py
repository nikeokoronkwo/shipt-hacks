"""SMS notifications sent through Twilio."""

import os

from twilio.rest import Client


def send_ride_request_sms(phone_number: str, ride_id: int, base_url: str) -> str:
    """Send a driver ride-request alert and return Twilio's message SID."""
    account_sid = os.environ["TWILIO_ACCOUNT_SID"]
    auth_token = os.environ["TWILIO_AUTH_TOKEN"]
    from_number = os.environ["TWILIO_PHONE_NUMBER"]

    message = Client(account_sid, auth_token).messages.create(
        body=(
            "New ShelterConnect ride request available. "
            f"View and accept: {base_url.rstrip('/')}/driver/requests/{ride_id} "
            "Reply STOP to opt out."
        ),
        from_=from_number,
        to=phone_number,
    )
    return message.sid
