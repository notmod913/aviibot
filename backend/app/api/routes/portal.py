"""Portal-level demo data API."""

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, Field

from app.services import portal_service

router = APIRouter(tags=["Portal data"])


class PortalSettings(BaseModel):
    displayName: str = Field(min_length=1, max_length=100)
    oversightUnit: str = Field(min_length=1, max_length=150)
    criticalInspectionAlerts: bool
    automaticSynchronization: bool


@router.get("/portal-data", response_model=dict)
def get_portal_data():
    """Return the persisted fixture collections used by the authority UI."""
    return portal_service.get_portal_data()


@router.put("/portal-data/settings", response_model=PortalSettings)
def update_portal_settings(settings: PortalSettings):
    """Persist authority preferences in SQLite."""
    return portal_service.update_portal_settings(settings.model_dump())


@router.get("/media/{media_id}")
def get_evidence_media(media_id: str):
    media = portal_service.get_evidence_media(media_id)
    if media is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence media not found")
    media_type, content = media
    return Response(
        content=content,
        media_type=media_type,
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )