import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import Depends
from fastapi.testclient import TestClient

from app.auth import jwt as verifier
from app.auth.dependencies import require_role
from app.main import app


@app.get("/test/driver")
def driver(user=Depends(require_role("driver"))):
    return user


@pytest.fixture
def keys(monkeypatch):
    private = ec.generate_private_key(ec.SECP256R1())
    class Keys:
        def get_signing_key_from_jwt(self, token):
            return type("Key", (), {"key": private.public_key()})()
    monkeypatch.setattr(verifier, "jwks_client", lambda: Keys())
    return private


def token(keys, **overrides):
    claims = {"sub": "user-1", "role": "driver", "iss": "http://localhost:3001",
              "aud": "shelterconnect-api", "exp": int(time.time()) + 900}
    claims.update(overrides)
    return jwt.encode(claims, keys, algorithm="ES256", headers={"kid": "test-key"})


def test_valid_identity_and_role(keys):
    client = TestClient(app)
    headers = {"Authorization": "Bearer " + token(keys)}
    assert client.get("/api/me", headers=headers).json() == {"id": "user-1", "role": "driver"}
    assert client.get("/test/driver", headers=headers).status_code == 200
    headers = {"Authorization": "Bearer " + token(keys, role="super_admin")}
    assert client.get("/test/driver", headers=headers).status_code == 403


@pytest.mark.parametrize("overrides", [
    {"exp": 1}, {"iss": "other"}, {"aud": "other"}, {"sub": ""},
    {"role": "admin"}, {"role": ["driver"]}, {"exp": None}, {"exp": []},
])
def test_invalid_claims(keys, overrides):
    response = TestClient(app).get("/api/me", headers={"Authorization": "Bearer " + token(keys, **overrides)})
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize("header", [None, "Basic abc", "Bearer malformed"])
def test_missing_or_malformed(keys, header):
    assert TestClient(app).get("/api/me", headers={"Authorization": header} if header else {}).status_code == 401


def test_bad_signature(keys):
    other_key = ec.generate_private_key(ec.SECP256R1())
    assert TestClient(app).get("/api/me", headers={"Authorization": "Bearer " + token(other_key)}).status_code == 401


def test_missing_required_claim(keys):
    encoded = jwt.encode({"sub": "user-1"}, keys, algorithm="ES256", headers={"kid": "test-key"})
    assert TestClient(app).get("/api/me", headers={"Authorization": "Bearer " + encoded}).status_code == 401


def test_unknown_keys_do_not_force_repeated_fetches(monkeypatch):
    calls = []
    private = ec.generate_private_key(ec.SECP256R1())
    key = jwt.algorithms.ECAlgorithm.to_jwk(private.public_key(), as_dict=True)
    key.update({"kid": "known", "use": "sig", "alg": "ES256"})
    def fetch(self):
        calls.append(1)
        data = {"keys": [key]}
        self.jwk_set_cache.put(data)
        self._last_successful_fetch = time.monotonic()
        return data
    monkeypatch.setattr(jwt.PyJWKClient, "fetch_data", fetch)
    client = jwt.PyJWKClient("http://unused.example/jwks", cooldown_duration=30)
    assert client.get_signing_key("known").key_id == "known"
    for _ in range(3):
        with pytest.raises(jwt.PyJWKClientError):
            client.get_signing_key("unknown")
    assert len(calls) == 1
