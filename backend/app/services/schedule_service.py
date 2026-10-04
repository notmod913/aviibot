"""
Inspection schedule service.

`generate_random_schedule` creates and persists demo schedule entries for
the Inspector Portal.
"""

import json
import os
import random
import uuid
from datetime import date, timedelta
from app.database import get_connection
from app.schemas.schedule import ScheduleItem

_DEMO_ORGANIZATIONS = [
    ("Asha Bal Vikas Sanstha", "Kothrud, Pune"),
    ("Sanjeevani Old Age Support Trust", "Hadapsar, Pune"),
    ("Prerna Mahila Sangh", "Shivaji Nagar, Pune"),
    ("Gramin Shiksha Kendra", "Wagholi, Pune"),
    ("Nirmal Jeevan Foundation", "Kondhwa, Pune"),
    ("Disha Punarvasan Kendra", "Aundh, Pune"),
]

_DEMO_INSPECTORS = ["Ramesh Kadam", "Sunita Patil", "Arjun Deshmukh"]

_DEMO_TIMES = ["09:30 AM", "10:30 AM", "11:00 AM", "02:00 PM", "03:30 PM"]

_DEMO_STATUSES = ["Scheduled", "In Progress", "Completed", "Missed"]

def get_all_schedules() -> list[ScheduleItem]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT id, organization, location, date, time, inspector, status FROM schedules ORDER BY rowid"
        ).fetchall()
    return [_with_site_location(ScheduleItem.model_validate(dict(row))) for row in rows]


def get_schedule_by_id(schedule_id: str) -> ScheduleItem | None:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT id, organization, location, date, time, inspector, status FROM schedules WHERE id = ?",
            (schedule_id,),
        ).fetchone()
    item = ScheduleItem.model_validate(dict(row)) if row else None
    return _with_site_location(item) if item else None


def _with_site_location(item: ScheduleItem) -> ScheduleItem:
    configured_sites = json.loads(os.getenv("SITE_LOCATIONS_JSON", "{}"))
    site = configured_sites.get(item.organization, {})
    return item.model_copy(
        update={
            "site_latitude": site.get("latitude"),
            "site_longitude": site.get("longitude"),
            "site_radius_m": site.get("radius_m"),
        }
    )


def generate_random_schedule(count: int = 3) -> list[ScheduleItem]:
    """
    Create `count` new demo schedule entries with random organisation,
    date, time, inspector and status, persist them in SQLite, and return
    only the newly created entries.

    This is a demo data generator, not a real scheduling algorithm.
    """
    new_items: list[ScheduleItem] = []

    for _ in range(count):
        organization, location = random.choice(_DEMO_ORGANIZATIONS)
        random_offset_days = random.randint(0, 14)
        scheduled_date = date.today() + timedelta(days=random_offset_days)

        item = ScheduleItem(
            id=f"SCH-{uuid.uuid4().hex[:6].upper()}",
            organization=organization,
            location=location,
            date=scheduled_date.isoformat(),
            time=random.choice(_DEMO_TIMES),
            inspector=random.choice(_DEMO_INSPECTORS),
            status=random.choice(_DEMO_STATUSES),
        )
        new_items.append(item)

    with get_connection() as connection:
        connection.executemany(
            """INSERT INTO schedules
            (id, organization, location, date, time, inspector, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)""",
            [
                (item.id, item.organization, item.location, item.date, item.time, item.inspector, item.status)
                for item in new_items
            ],
        )

    return new_items
