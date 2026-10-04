"""
Pydantic schemas for the inspection schedule.

A schedule item represents an inspection that has been assigned to an
inspector but not necessarily carried out yet. Records are persisted in
SQLite by the schedule service.
"""

from typing import Optional

from pydantic import BaseModel


class ScheduleItem(BaseModel):
    id: str
    organization: str
    location: str
    date: str  # YYYY-MM-DD
    time: str  # e.g. "10:30 AM"
    inspector: str
    status: str  # e.g. "Scheduled", "In Progress", "Completed", "Missed"
    site_latitude: Optional[float] = None
    site_longitude: Optional[float] = None
    site_radius_m: Optional[float] = None
