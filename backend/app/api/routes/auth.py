"""Portal login endpoint."""

from time import time
from typing import Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.auth_service import authenticate

router = APIRouter(tags=["Authentication"])


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=128)
    portal_role: Literal["Authority Officer", "Inspector"]


@router.post("/auth/login")
def login(payload: LoginRequest):
    session = authenticate(payload.username, payload.password, payload.portal_role)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password for the selected portal",
        )

    session["expiresAt"] = int((time() + 5 * 60) * 1000)
    return session