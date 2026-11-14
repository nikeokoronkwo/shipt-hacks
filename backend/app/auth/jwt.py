"""Verify Better Auth JWTs without sharing its private signing keys."""

import os
from functools import lru_cache

import jwt
from pydantic import BaseModel


class CurrentUser(BaseModel):
    id: str
    role: str


@lru_cache
def jwks_client() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(
        os.getenv("AUTH_JWKS_URL", "http://localhost:3001/api/auth/jwks"),
        cache_jwk_set=True,
        lifespan=300,
        timeout=5,
        cooldown_duration=30,
    )


def verify_token(token: str) -> CurrentUser:
    header = jwt.get_unverified_header(token)
    if header.get("alg") != "ES256" or not isinstance(header.get("kid"), str):
        raise jwt.InvalidTokenError("Invalid signing header")
    key = jwks_client().get_signing_key_from_jwt(token)
    claims = jwt.decode(
        token,
        key.key,
        algorithms=["ES256"],
        issuer=os.getenv("AUTH_ISSUER", "http://localhost:3001"),
        audience=os.getenv("AUTH_AUDIENCE", "shelterconnect-api"),
        options={"require": ["sub", "role", "iss", "aud", "exp"]},
    )
    if not isinstance(claims["sub"], str) or not claims["sub"].strip():
        raise jwt.InvalidTokenError("Invalid subject")
    if claims["role"] not in ("driver", "shelter_admin", "super_admin"):
        raise jwt.InvalidTokenError("Invalid role")
    return CurrentUser(id=claims["sub"], role=claims["role"])
