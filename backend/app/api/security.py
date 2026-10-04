import hmac
import os
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer_scheme = HTTPBearer(auto_error=False, scheme_name="API access token")


def require_api_access(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> None:
    expected_token = os.getenv("API_ACCESS_TOKEN", "").strip()
    if not expected_token:
        client_host = request.client.host if request.client else ""
        if os.getenv("APP_ENV", "development").strip().lower() == "development" and client_host in {
            "127.0.0.1",
            "::1",
            "::ffff:127.0.0.1",
        }:
            return
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="API authentication is not configured",
        )

    if len(expected_token) < 32:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="API authentication is not configured",
        )

    if credentials is None or not hmac.compare_digest(credentials.credentials, expected_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid API access token",
            headers={"WWW-Authenticate": "Bearer"},
        )