"""Reusable dependencies; role checks are exact, with no implicit hierarchy."""

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import PyJWTError

from app.auth.jwt import CurrentUser, verify_token

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> CurrentUser:
    if credentials is not None:
        try:
            return verify_token(credentials.credentials)
        except (PyJWTError, TypeError, ValueError):
            pass
    raise HTTPException(
        status_code=401,
        detail="Missing or invalid authentication",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_role(*roles: str):
    if not roles or any(role not in {"driver", "shelter_admin", "super_admin"} for role in roles):
        raise ValueError("Specify at least one supported role")

    def dependency(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return dependency
