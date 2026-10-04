"""
Pydantic schemas for inspection records.

An inspection record represents a visit that has been (or is being)
carried out. `InspectionCreate` is what the API accepts when a new record
is submitted; `Inspection` is what the API returns, with a server-assigned
id. Records are persisted in SQLite and can move to PostgreSQL/PostGIS
without changing this contract.
"""

from typing import Optional

from pydantic import BaseModel, Field


class InspectionBase(BaseModel):
    organization: str
    location: str
    date: str  # YYYY-MM-DD
    time: str  # e.g. "10:30 AM"
    inspector: str
    status: str = "Submitted"  # e.g. "Submitted", "Verified"
    notes: Optional[str] = None
    schedule_id: Optional[str] = None
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    location_accuracy_m: Optional[float] = Field(default=None, ge=0)
    location_captured_at: Optional[str] = None
    client_submission_id: Optional[str] = Field(default=None, max_length=100)


class InspectionCreate(InspectionBase):
    """Fields required to create a new inspection record."""


class Inspection(InspectionBase):
    """An inspection record as returned by the API, with its id."""

    id: str
    location_distance_m: Optional[float] = None
    location_verified: Optional[bool] = None
    location_check_status: Optional[str] = None
