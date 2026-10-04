"""Organization registry endpoints."""

import sqlite3

from fastapi import APIRouter, HTTPException, status

from app.schemas.organization import Organization, OrganizationCreate
from app.services import organization_service

router = APIRouter(tags=["Organizations"])


@router.get("/organizations", response_model=list[Organization])
def list_organizations():
    return organization_service.get_all_organizations()


@router.get("/organizations/{organization_id}", response_model=Organization)
def get_organization(organization_id: str):
    organization = organization_service.get_organization_by_id(organization_id)
    if organization is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    return organization


@router.post("/organizations", response_model=Organization, status_code=status.HTTP_201_CREATED)
def create_organization(payload: OrganizationCreate):
    try:
        return organization_service.create_organization(payload)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except sqlite3.IntegrityError as error:
        raise HTTPException(status_code=409, detail="An organization with this name or registration ID already exists.") from error