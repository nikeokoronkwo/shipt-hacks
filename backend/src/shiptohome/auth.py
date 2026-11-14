"""JWT verification shared by all protected FastAPI endpoints."""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import PyJWTError

from shiptohome.schemas import CurrentUser


AUTH_JWKS_URL = os.getenv("AUTH_JWKS_URL", "http://localhost:3000/api/auth/jwks")
AUTH_ISSUER = os.getenv("AUTH_ISSUER", "http://localhost:3000")
AUTH_AUDIENCE = os.getenv("AUTH_AUDIENCE", "shelterconnect-api")
ALGORITHM = "EdDSA"
SUPPORTED_ROLES = {"driver", "shelter_admin", "super_admin"}
bearer_scheme = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def jwks_client() -> PyJWKClient:
    # Cache keys for five minutes, cap network waits, and cool down repeated
    # fetches for unknown key IDs to avoid turning bad tokens into a DoS.
    return PyJWKClient(
        AUTH_JWKS_URL,
        cache_jwk_set=True,
        cache_keys=True,
        lifespan=300,
        timeout=5,
        cooldown_duration=30,
    )


def unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="A valid Better Auth access token is required.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized()

    try:
        header = jwt.get_unverified_header(credentials.credentials)
        if (
            header.get("alg") != ALGORITHM
            or not isinstance(header.get("kid"), str)
            or not header["kid"]
        ):
            raise ValueError("invalid JWT signing header")
        signing_key = jwks_client().get_signing_key_from_jwt(credentials.credentials)
        payload = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=[ALGORITHM],
            audience=AUTH_AUDIENCE,
            issuer=AUTH_ISSUER,
            options={"require": ["exp", "sub", "aud", "iss"]},
        )
        role = payload.get("role")
        if not isinstance(role, str) or role not in SUPPORTED_ROLES:
            raise ValueError("missing or unsupported role")
        subject = payload.get("sub")
        if not isinstance(subject, str) or not subject.strip():
            raise ValueError("missing subject")
        phone_number = payload.get("phone_number")
        if phone_number is not None and not isinstance(phone_number, str):
            raise ValueError("invalid phone number claim")
        return CurrentUser(
            id=subject,
            role=role,
            phone_number=phone_number,
            phone_number_verified=payload.get("phone_number_verified") is True,
        )
    except (PyJWTError, TypeError, ValueError, OSError):
        raise unauthorized() from None


def require_role(*allowed_roles: str) -> Callable[[CurrentUser], CurrentUser]:
    if not allowed_roles or any(role not in SUPPORTED_ROLES for role in allowed_roles):
        raise ValueError("Specify at least one supported ShelterConnect role.")

    def dependency(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account does not have permission for this action.",
            )
        return user

    return dependency
