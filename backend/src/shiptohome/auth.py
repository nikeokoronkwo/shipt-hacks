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
ALGORITHMS = ["EdDSA", "ES256", "RS256"]
bearer_scheme = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def jwks_client() -> PyJWKClient:
    # PyJWKClient caches both the JWKS document and signing keys. It refreshes
    # on an unknown ``kid``, so Better Auth key rotation works without a deploy.
    return PyJWKClient(AUTH_JWKS_URL, cache_keys=True, lifespan=300)


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
        signing_key = jwks_client().get_signing_key_from_jwt(credentials.credentials)
        payload = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=ALGORITHMS,
            audience=AUTH_AUDIENCE,
            issuer=AUTH_ISSUER,
            options={"require": ["exp", "sub", "aud", "iss"]},
        )
        role = payload.get("role")
        if role not in {"driver", "shelter_admin", "super_admin"}:
            raise ValueError("missing or unsupported role")
        subject = payload.get("sub")
        if not isinstance(subject, str) or not subject:
            raise ValueError("missing subject")
        return CurrentUser(id=subject, role=role)
    except (PyJWTError, ValueError, OSError):
        raise unauthorized() from None


def require_role(*allowed_roles: str) -> Callable[[CurrentUser], CurrentUser]:
    def dependency(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account does not have permission for this action.",
            )
        return user

    return dependency
