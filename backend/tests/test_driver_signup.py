"""Exercise the running signup API with signed JWTs and real SQLite storage.

Only JWKS retrieval is replaced with an in-memory public key. Bearer parsing,
signature/claim verification, role checks, schemas, routes, and persistence all
use the production implementation. No Better Auth or Twilio credentials needed.
"""

from __future__ import annotations

import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import jwt
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from main import app
from shiptohome import auth as verifier
from shiptohome.database import Base, get_db
from shiptohome.models import Driver


REGISTRATION = {
    "phone_number": "+12055550100",
    "vehicle_make": "Toyota",
    "vehicle_model": "Prius",
    "vehicle_color": "Blue",
    "license_plate": "DEMO 123",
}


class DriverSignupTests(unittest.TestCase):
    def setUp(self):
        temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(temporary_directory.cleanup)
        self.engine = create_engine(
            f"sqlite:///{Path(temporary_directory.name) / 'signup.sqlite3'}",
            connect_args={"check_same_thread": False},
        )
        self.addCleanup(self.engine.dispose)
        Base.metadata.create_all(self.engine)

        def database():
            with Session(self.engine) as db:
                yield db

        overrides = app.dependency_overrides.copy()
        app.dependency_overrides[get_db] = database

        def restore_overrides():
            app.dependency_overrides.clear()
            app.dependency_overrides.update(overrides)

        self.addCleanup(restore_overrides)
        # Do not enter a lifespan context: it initializes the real database.
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        self.private_key = Ed25519PrivateKey.generate()
        jwks = SimpleNamespace(
            get_signing_key_from_jwt=lambda _token: SimpleNamespace(
                key=self.private_key.public_key()
            )
        )
        jwks_patch = patch.object(verifier, "jwks_client", return_value=jwks)
        jwks_patch.start()
        self.addCleanup(jwks_patch.stop)

    def headers(self, *, private_key=None, **overrides):
        claims = {
            "sub": "new-driver",
            "role": "driver",
            "phone_number": "+12055550100",
            "phone_number_verified": True,
            "iss": verifier.AUTH_ISSUER,
            "aud": verifier.AUTH_AUDIENCE,
            "exp": int(time.time()) + 300,
        }
        claims.update(overrides)
        token = jwt.encode(
            claims,
            private_key or self.private_key,
            algorithm="EdDSA",
            headers={"kid": "signup-test-key"},
        )
        return {"Authorization": f"Bearer {token}"}

    def initialize(self, *, headers=None, body=None):
        return self.client.post(
            "/api/drivers/me/initialize",
            headers=headers if headers is not None else self.headers(),
            json={**REGISTRATION, **(body or {})},
        )

    def assert_no_profiles(self):
        with Session(self.engine) as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(Driver)), 0)

    def test_signup_persists_vehicle_and_retries_without_duplicate_profiles(self):
        response = self.initialize(body={"sms_notifications_enabled": True})
        self.assertEqual(response.status_code, 201, response.text)
        profile = response.json()
        self.assertEqual(profile["auth_user_id"], "new-driver")
        for field, value in REGISTRATION.items():
            self.assertEqual(profile[field], value)
        self.assertTrue(profile["sms_notifications_enabled"])
        # Current local-demo registration automatically verifies drivers, but
        # drivers still choose when to become available for dispatch.
        self.assertTrue(profile["is_verified"])
        self.assertFalse(profile["is_available"])

        retry = self.initialize(body={
            "sms_notifications_enabled": False,
            "vehicle_color": "Silver",
            "license_plate": "DEMO 456",
        })
        self.assertEqual(retry.status_code, 201, retry.text)
        self.assertEqual(retry.json()["id"], profile["id"])
        self.assertFalse(retry.json()["sms_notifications_enabled"])
        self.assertEqual(retry.json()["vehicle_color"], "Silver")
        self.assertEqual(retry.json()["license_plate"], "DEMO 456")
        fetched = self.client.get("/api/drivers/me", headers=self.headers())
        self.assertEqual(fetched.status_code, 200, fetched.text)
        self.assertEqual(fetched.json(), retry.json())
        with Session(self.engine) as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(Driver)), 1)
            stored = db.get(Driver, profile["id"])
            self.assertEqual(stored.vehicle_color, "Silver")
            self.assertFalse(stored.sms_notifications_enabled)

    def test_signup_uses_signed_identity_and_server_dispatch_defaults(self):
        response = self.initialize(body={
            "auth_user_id": "victim",
            "is_verified": False,
            "is_available": True,
        })
        self.assertEqual(response.status_code, 201, response.text)
        profile = response.json()
        self.assertEqual(profile["auth_user_id"], "new-driver")
        self.assertTrue(profile["is_verified"])
        self.assertFalse(profile["is_available"])
        self.assertFalse(profile["sms_notifications_enabled"])
        denied = self.client.get("/api/drivers/me", headers=self.headers(sub="victim"))
        self.assertEqual(denied.status_code, 404, denied.text)

    def test_email_registration_does_not_require_sms_verified_jwt_claims(self):
        response = self.initialize(
            headers=self.headers(phone_number=None, phone_number_verified=False),
            body={"phone_number": "+12055550200"},
        )
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["phone_number"], "+12055550200")
        self.assertTrue(response.json()["is_verified"])
        self.assertFalse(response.json()["is_available"])
        self.assertFalse(response.json()["sms_notifications_enabled"])

    def test_registration_requires_contact_and_complete_vehicle_details(self):
        for field in REGISTRATION:
            with self.subTest(field=field):
                missing = {key: value for key, value in REGISTRATION.items() if key != field}
                response = self.client.post(
                    "/api/drivers/me/initialize", headers=self.headers(), json=missing,
                )
                self.assertEqual(response.status_code, 422, response.text)
                blank = self.initialize(body={field: "   "})
                self.assertEqual(blank.status_code, 422, blank.text)
                self.assert_no_profiles()

    def test_anonymous_and_invalid_bearer_tokens_cannot_create_profiles(self):
        invalid_headers = (
            {},
            {"Authorization": "Bearer malformed"},
            self.headers(exp=1),
            self.headers(aud="another-api"),
            self.headers(iss="https://another-issuer.example"),
            self.headers(private_key=Ed25519PrivateKey.generate()),
        )
        for headers in invalid_headers:
            with self.subTest(headers=headers):
                response = self.initialize(headers=headers)
                self.assertEqual(response.status_code, 401, response.text)
                self.assertEqual(response.headers.get("www-authenticate"), "Bearer")
                self.assert_no_profiles()

    def test_admin_roles_cannot_initialize_driver_profiles(self):
        for role in ("shelter_admin", "super_admin"):
            with self.subTest(role=role):
                response = self.initialize(headers=self.headers(role=role))
                self.assertEqual(response.status_code, 403, response.text)
                self.assert_no_profiles()

    def test_email_driver_can_update_consent_without_replacing_registered_contact(self):
        email_headers = self.headers(phone_number=None, phone_number_verified=False)
        response = self.initialize(headers=email_headers)
        self.assertEqual(response.status_code, 201, response.text)
        profile_id = response.json()["id"]
        enabled = self.client.patch(
            "/api/drivers/me",
            headers=email_headers,
            json={"sms_notifications_enabled": True, "phone_number": "+12055559999"},
        )
        self.assertEqual(enabled.status_code, 200, enabled.text)
        self.assertTrue(enabled.json()["sms_notifications_enabled"])
        self.assertEqual(enabled.json()["phone_number"], REGISTRATION["phone_number"])
        disabled = self.client.patch(
            "/api/drivers/me",
            # Even a different verified phone in an older JWT must not mutate
            # the profile's contact through this preferences-only endpoint.
            headers=self.headers(phone_number="+12055558888"),
            json={"sms_notifications_enabled": False},
        )
        self.assertEqual(disabled.status_code, 200, disabled.text)
        self.assertFalse(disabled.json()["sms_notifications_enabled"])
        with Session(self.engine) as db:
            stored = db.get(Driver, profile_id)
            self.assertEqual(stored.phone_number, REGISTRATION["phone_number"])
            self.assertFalse(stored.sms_notifications_enabled)
            self.assertEqual(stored.vehicle_make, REGISTRATION["vehicle_make"])

    def test_browser_can_preflight_authenticated_signup_from_frontend_origin(self):
        response = self.client.options(
            "/api/drivers/me/initialize",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.headers["access-control-allow-origin"], "http://localhost:3000")
        self.assertIn("POST", response.headers["access-control-allow-methods"])
        allowed_headers = response.headers["access-control-allow-headers"].lower()
        self.assertIn("authorization", allowed_headers)
        self.assertIn("content-type", allowed_headers)


if __name__ == "__main__":
    unittest.main()
