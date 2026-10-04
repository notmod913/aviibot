"""Inspection record persistence and location-verification service."""

import sqlite3
import uuid
from math import atan2, cos, radians, sin, sqrt
from typing import Optional

from app.database import get_connection
from app.schemas.inspection import Inspection, InspectionCreate
from app.services import schedule_service


def get_all_inspections() -> list[Inspection]:
    with get_connection() as connection:
        rows = connection.execute(
            """SELECT id, organization, location, date, time, inspector, status, notes,
            schedule_id, latitude, longitude, location_accuracy_m, location_captured_at,
            location_distance_m, location_verified, location_check_status
            FROM inspections ORDER BY rowid"""
        ).fetchall()
    return [Inspection.model_validate(dict(row)) for row in rows]


def get_inspection_by_id(inspection_id: str) -> Optional[Inspection]:
    with get_connection() as connection:
        row = connection.execute(
            """SELECT id, organization, location, date, time, inspector, status, notes,
            schedule_id, latitude, longitude, location_accuracy_m, location_captured_at,
            location_distance_m, location_verified, location_check_status
            FROM inspections WHERE id = ?""",
            (inspection_id,),
        ).fetchone()
    return Inspection.model_validate(dict(row)) if row else None


def create_inspection(data: InspectionCreate) -> Inspection:
    if data.client_submission_id:
        with get_connection() as connection:
            row = connection.execute(
                """SELECT id, organization, location, date, time, inspector, status, notes,
                schedule_id, latitude, longitude, location_accuracy_m, location_captured_at,
                location_distance_m, location_verified, location_check_status
                FROM inspections WHERE client_submission_id = ?""",
                (data.client_submission_id,),
            ).fetchone()
        if row:
            return Inspection.model_validate(dict(row))

    fields = data.model_dump()
    distance_m = None
    location_verified = None
    location_check_status = "not_configured"
    scheduled = schedule_service.get_schedule_by_id(data.schedule_id) if data.schedule_id else None
    if data.latitude is None or data.longitude is None:
        location_check_status = "not_captured"
    elif (
        scheduled
        and scheduled.site_latitude is not None
        and scheduled.site_longitude is not None
        and scheduled.site_radius_m is not None
    ):
        distance_m = _distance_m(
            data.latitude,
            data.longitude,
            scheduled.site_latitude,
            scheduled.site_longitude,
        )
        accuracy_m = data.location_accuracy_m
        if accuracy_m is None:
            location_check_status = "inconclusive"
        elif distance_m + accuracy_m <= scheduled.site_radius_m:
            location_verified = True
            location_check_status = "verified"
        elif distance_m - accuracy_m > scheduled.site_radius_m:
            location_verified = False
            location_check_status = "outside_radius"
        else:
            location_check_status = "inconclusive"

    record = Inspection(
        id=f"REC-{uuid.uuid4().hex[:8].upper()}",
        **fields,
        location_distance_m=round(distance_m, 1) if distance_m is not None else None,
        location_verified=location_verified,
        location_check_status=location_check_status,
    )

    try:
        with get_connection() as connection:
            connection.execute(
                """INSERT INTO inspections (
                    id, organization, location, date, time, inspector, status, notes,
                    schedule_id, latitude, longitude, location_accuracy_m,
                    location_captured_at, client_submission_id, location_distance_m,
                    location_verified, location_check_status
                ) VALUES (
                    :id, :organization, :location, :date, :time, :inspector, :status, :notes,
                    :schedule_id, :latitude, :longitude, :location_accuracy_m,
                    :location_captured_at, :client_submission_id, :location_distance_m,
                    :location_verified, :location_check_status
                )""",
                record.model_dump(),
            )
    except sqlite3.IntegrityError:
        if data.client_submission_id:
            with get_connection() as connection:
                row = connection.execute(
                    """SELECT id, organization, location, date, time, inspector, status, notes,
                    schedule_id, latitude, longitude, location_accuracy_m, location_captured_at,
                    location_distance_m, location_verified, location_check_status
                    FROM inspections WHERE client_submission_id = ?""",
                    (data.client_submission_id,),
                ).fetchone()
            if row:
                return Inspection.model_validate(dict(row))
        raise

    return record


def _distance_m(latitude_a: float, longitude_a: float, latitude_b: float, longitude_b: float) -> float:
    earth_radius_m = 6_371_000
    latitude_delta = radians(latitude_b - latitude_a)
    longitude_delta = radians(longitude_b - longitude_a)
    haversine = (
        sin(latitude_delta / 2) ** 2
        + cos(radians(latitude_a))
        * cos(radians(latitude_b))
        * sin(longitude_delta / 2) ** 2
    )
    haversine = min(1, max(0, haversine))
    return earth_radius_m * 2 * atan2(sqrt(haversine), sqrt(1 - haversine))
