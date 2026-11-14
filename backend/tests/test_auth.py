"""Unit checks for Better Auth JWT verification and role handling."""

from __future__ import annotations

import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import jwt
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from shiptohome import auth as verifier


class FakeJwksClient:
    def __init__(self, public_key):
        self.public_key = public_key

    def get_signing_key_from_jwt(self, _token: str):
        return SimpleNamespace(key=self.public_key)


class AuthTests(unittest.TestCase):
    def setUp(self):
        self.private_key = Ed25519PrivateKey.generate()
        self.jwks_patch = patch.object(
            verifier,
            "jwks_client",
            return_value=FakeJwksClient(self.private_key.public_key()),
        )
        self.jwks_patch.start()
        self.addCleanup(self.jwks_patch.stop)

    def make_token(self, **overrides):
        claims = {
            "sub": "user-1",
            "role": "driver",
            "phone_number": "+12055550100",
            "phone_number_verified": True,
            "iss": verifier.AUTH_ISSUER,
            "aud": verifier.AUTH_AUDIENCE,
            "exp": int(time.time()) + 300,
        }
        claims.update(overrides)
        return jwt.encode(
            claims,
            self.private_key,
            algorithm="EdDSA",
            headers={"kid": "test-key"},
        )

    def credentials(self, token: str):
        return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    def assert_unauthorized(self, token: str):
        with self.assertRaises(HTTPException) as raised:
            verifier.get_current_user(self.credentials(token))
        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(raised.exception.headers["WWW-Authenticate"], "Bearer")

    def test_valid_verified_driver_claims(self):
        user = verifier.get_current_user(self.credentials(self.make_token()))
        self.assertEqual(user.id, "user-1")
        self.assertEqual(user.role, "driver")
        self.assertEqual(user.phone_number, "+12055550100")
        self.assertTrue(user.phone_number_verified)

    def test_supported_roles_are_accepted(self):
        for role in ("driver", "shelter_admin", "super_admin"):
            with self.subTest(role=role):
                self.assertEqual(
                    verifier.get_current_user(self.credentials(self.make_token(role=role))).role,
                    role,
                )

    def test_invalid_claims_are_rejected(self):
        invalid_claims = (
            {"exp": 1},
            {"iss": "https://wrong.example"},
            {"aud": "wrong-api"},
            {"sub": " "},
            {"role": "admin"},
            {"role": ["driver"]},
            {"phone_number": 12055550100},
        )
        for claims in invalid_claims:
            with self.subTest(claims=claims):
                self.assert_unauthorized(self.make_token(**claims))

    def test_only_configured_signing_algorithm_is_accepted(self):
        token = jwt.encode(
            {"sub": "user-1", "role": "driver"},
            "not-a-real-signing-key-with-over-32-bytes",
            algorithm="HS256",
            headers={"kid": "test-key"},
        )
        self.assert_unauthorized(token)

    def test_bad_signature_is_rejected(self):
        other_key = Ed25519PrivateKey.generate()
        token = jwt.encode(
            {
                "sub": "user-1",
                "role": "driver",
                "iss": verifier.AUTH_ISSUER,
                "aud": verifier.AUTH_AUDIENCE,
                "exp": int(time.time()) + 300,
            },
            other_key,
            algorithm="EdDSA",
            headers={"kid": "test-key"},
        )
        self.assert_unauthorized(token)

    def test_missing_or_malformed_credentials_are_rejected(self):
        for credentials in (
            None,
            HTTPAuthorizationCredentials(scheme="Basic", credentials="abc"),
            HTTPAuthorizationCredentials(scheme="Bearer", credentials="malformed"),
        ):
            with self.subTest(credentials=credentials):
                with self.assertRaises(HTTPException) as raised:
                    verifier.get_current_user(credentials)
                self.assertEqual(raised.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
