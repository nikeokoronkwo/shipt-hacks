"""Optional Twilio delivery for consented driver notifications."""

from __future__ import annotations

import logging
import os
from typing import Literal

import httpx

logger = logging.getLogger(__name__)


SmsDeliveryResult = Literal["sent", "not_configured", "unsubscribed", "failed"]


def send_sms(to: str, body: str) -> SmsDeliveryResult:
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_FROM_NUMBER")
    if not account_sid or not auth_token or not from_number:
        return "not_configured"

    try:
        response = httpx.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json",
            auth=(account_sid, auth_token),
            data={"To": to, "From": from_number, "Body": body},
            timeout=10,
        )
        response.raise_for_status()
        return "sent"
    except httpx.HTTPStatusError as error:
        try:
            twilio_code = error.response.json().get("code")
        except (ValueError, AttributeError):
            twilio_code = None
        if twilio_code in {21610, 30630}:
            return "unsubscribed"
        logger.warning("Twilio driver alert failed (%s).", type(error).__name__)
        return "failed"
    except httpx.HTTPError as error:
        # Avoid logging phone numbers or ride/requester details.
        logger.warning("Twilio driver alert failed (%s).", type(error).__name__)
        return "failed"
