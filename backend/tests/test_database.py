import sqlite3
import tempfile
import unittest
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from app import database
from app.schemas.inspection import InspectionCreate
from app.schemas.organization import OrganizationCreate
from app.schemas.schedule import ScheduleCreate
from app.services import auth_service, inspection_service, organization_service, portal_service, reverse_geocode_service, schedule_service, user_service


class DatabasePersistenceTests(unittest.TestCase):
    def setUp(self):
        self.temp_directory = tempfile.TemporaryDirectory()
        self.original_path = database.DATABASE_PATH
        self.original_initialized = database._initialized
        database.DATABASE_PATH = Path(self.temp_directory.name) / "demo.sqlite3"
        database._initialized = False
        database.initialize_database()

    def tearDown(self):
        database.DATABASE_PATH = self.original_path
        database._initialized = self.original_initialized
        self.temp_directory.cleanup()

    def test_demo_seed_is_idempotent_and_schedule_writes_persist(self):
        self.assertEqual(len(user_service.get_all_users()), 3)
        self.assertEqual(len(schedule_service.get_all_schedules()), 2)
        seeded_inspections = [
            item for item in inspection_service.get_all_inspections()
            if item.id.startswith("REC-100")
        ]
        self.assertEqual(len(seeded_inspections), 5)
        historical_samples = [
            item for item in inspection_service.get_all_inspections()
            if item.id.startswith("DEMO-HIST-")
        ]
        self.assertEqual(len(historical_samples), 30)
        self.assertTrue(all(item.notes == "Fictional historical demo inspection." for item in historical_samples))
        self.assertTrue(all(item.date < date.today().isoformat() for item in historical_samples))
        self.assertTrue(all(item.photo_media_id for item in seeded_inspections))
        self.assertTrue(all(item.latitude is not None for item in seeded_inspections))
        self.assertTrue(all(item.site_latitude is not None for item in schedule_service.get_all_schedules()))
        self.assertTrue(all(item.date >= date.today().isoformat() for item in schedule_service.get_all_schedules()))

        generated = schedule_service.generate_random_schedule(2)
        database.initialize_database()

        self.assertEqual(len(generated), 2)
        self.assertEqual(len(schedule_service.get_all_schedules()), 4)
        self.assertTrue(all(item.status == "Scheduled" for item in generated))
        self.assertTrue(all(item.site_radius_m == 100 for item in generated))
        self.assertTrue(all(item.date > date.today().isoformat() for item in generated))

    def test_create_schedule_uses_registered_organization_and_inspector(self):
        organization = organization_service.create_organization(
            OrganizationCreate(
                name="Real Scheduling Test Organization",
                location="Vijayawada",
                address="1 Demo Road, Vijayawada",
                latitude=16.5122,
                longitude=80.6843,
                radius_m=250,
            )
        )
        inspector = user_service.get_all_users()[0]
        scheduled_date = date.today() + timedelta(days=20)

        created = schedule_service.create_scheduled_inspection(
            ScheduleCreate(
                organization_id=organization.id,
                inspector_id=inspector.id,
                date=scheduled_date,
                time="10:30",
            )
        )

        self.assertEqual(created.organization, organization.name)
        self.assertEqual(created.location, organization.address)
        self.assertEqual(created.inspector, inspector.name)
        self.assertEqual(created.date, scheduled_date.isoformat())
        self.assertEqual(created.time, "10:30 AM")
        self.assertEqual(created.status, "Scheduled")
        self.assertEqual(created.site_latitude, organization.latitude)
        self.assertEqual(created.site_longitude, organization.longitude)
        self.assertEqual(created.site_radius_m, organization.radius_m)
        self.assertEqual(schedule_service.get_schedule_by_id(created.id), created)

    def test_create_schedule_rejects_unknown_organization_or_inspector(self):
        scheduled_date = date.today() + timedelta(days=1)
        with self.assertRaisesRegex(LookupError, "organization"):
            schedule_service.create_scheduled_inspection(
                ScheduleCreate(
                    organization_id="unknown-organization",
                    inspector_id=1,
                    date=scheduled_date,
                    time="10:00",
                )
            )

        organization = organization_service.get_all_organizations()[0]
        with self.assertRaisesRegex(LookupError, "inspector"):
            schedule_service.create_scheduled_inspection(
                ScheduleCreate(
                    organization_id=organization.id,
                    inspector_id=99999,
                    date=scheduled_date,
                    time="10:00",
                )
            )

    def test_create_schedule_rejects_past_dates(self):
        organization = organization_service.get_all_organizations()[0]
        with self.assertRaisesRegex(ValueError, "future"):
            schedule_service.create_scheduled_inspection(
                ScheduleCreate(
                    organization_id=organization.id,
                    inspector_id=1,
                    date=date.today() - timedelta(days=1),
                    time="10:00",
                )
            )

    def test_create_schedule_rejects_past_time_today(self):
        organization = organization_service.get_all_organizations()[0]
        past_time = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).time()
        with self.assertRaisesRegex(ValueError, "future"):
            schedule_service.create_scheduled_inspection(
                ScheduleCreate(
                    organization_id=organization.id,
                    inspector_id=1,
                    date=date.today(),
                    time=past_time,
                )
            )

    def test_create_schedule_prevents_inspector_double_booking(self):
        organization = organization_service.get_all_organizations()[0]
        inspector = user_service.get_all_users()[0]
        scheduled_date = date.today() + timedelta(days=3)
        payload = ScheduleCreate(
            organization_id=organization.id,
            inspector_id=inspector.id,
            date=scheduled_date,
            time="10:00",
        )
        schedule_service.create_scheduled_inspection(payload)

        with self.assertRaisesRegex(ValueError, "already has an inspection scheduled"):
            schedule_service.create_scheduled_inspection(payload)

    def test_inspection_submission_retry_returns_persisted_record(self):
        payload = InspectionCreate(
            organization="Demo Organization",
            location="Pune",
            date="2026-10-04",
            time="10:00 AM",
            inspector="Ramesh Kadam",
            client_submission_id="retry-demo-001",
        )

        first = inspection_service.create_inspection(payload)
        second = inspection_service.create_inspection(payload)

        self.assertEqual(first.id, second.id)
        self.assertEqual(inspection_service.get_inspection_by_id(first.id), first)

    def test_delete_inspector_submission_removes_photo_and_reopens_schedule(self):
        schedule = schedule_service.get_schedule_by_id("SCH-1001")
        self.assertIsNotNone(schedule)
        record = inspection_service.create_inspection(
            InspectionCreate(
                organization=schedule.organization,
                location=schedule.location,
                date=schedule.date,
                time=schedule.time,
                inspector=schedule.inspector,
                schedule_id=schedule.id,
                photo_data_url="data:image/jpeg;base64,aGVsbG8=",
                client_submission_id="delete-live-record",
            )
        )
        self.assertEqual(schedule_service.get_schedule_by_id(schedule.id).status, "Completed")

        self.assertTrue(inspection_service.delete_inspection(record.id))

        self.assertIsNone(inspection_service.get_inspection_by_id(record.id))
        self.assertIsNone(portal_service.get_evidence_media(record.photo_media_id))
        self.assertEqual(schedule_service.get_schedule_by_id(schedule.id).status, "Scheduled")
        self.assertFalse(inspection_service.delete_inspection(record.id))

    def test_delete_sample_record_persists_across_database_reinitialization(self):
        self.assertTrue(inspection_service.delete_inspection("REC-1001"))
        self.assertIsNone(inspection_service.get_inspection_by_id("REC-1001"))

        database._initialized = False
        database.initialize_database()

        self.assertIsNone(inspection_service.get_inspection_by_id("REC-1001"))

    def test_authority_review_status_updates_all_persisted_records_and_survives_restart(self):
        record = inspection_service.create_inspection(
            InspectionCreate(
                organization="Demo Organization",
                location="Pune",
                date="2026-10-04",
                time="10:00 AM",
                inspector="Ramesh Kadam",
                client_submission_id="review-status-demo",
            )
        )

        flagged = inspection_service.update_review_status(record.id, "Flagged")
        verified = inspection_service.update_review_status(record.id, "Verified")

        self.assertEqual(flagged.status, "Flagged")
        self.assertEqual(verified.status, "Verified")
        sample = inspection_service.update_review_status("REC-1001", "Flagged")
        self.assertEqual(sample.status, "Flagged")

        database._initialized = False
        database.initialize_database()
        self.assertEqual(inspection_service.get_inspection_by_id("REC-1001").status, "Flagged")

    def test_inspection_uses_actual_submission_time_and_keeps_scheduled_time(self):
        schedule = schedule_service.get_schedule_by_id("SCH-1001")
        self.assertIsNotNone(schedule)
        record = inspection_service.create_inspection(
            InspectionCreate(
                organization=schedule.organization,
                location=schedule.location,
                date=schedule.date,
                time=schedule.time,
                inspector=schedule.inspector,
                schedule_id=schedule.id,
                photo_captured_at="2026-10-04T12:00:00+05:30",
                client_submission_id="actual-time-demo",
            )
        )
        india_timezone = timezone(timedelta(hours=5, minutes=30))

        self.assertEqual(record.date, datetime.now(india_timezone).date().isoformat())
        self.assertEqual(record.scheduled_date, schedule.date)
        self.assertEqual(record.scheduled_time, schedule.time)
        self.assertEqual(record.photo_captured_at, "2026-10-04T12:00:00+05:30")
        self.assertIsNotNone(record.submitted_at)
        self.assertEqual(schedule_service.get_schedule_by_id(schedule.id).status, "Completed")

    def test_inspection_photo_is_persisted_and_returned_as_media(self):
        payload = InspectionCreate(
            organization="Demo Organization",
            location="Pune",
            date="2026-10-04",
            time="10:00 AM",
            inspector="Ramesh Kadam",
            photo_data_url="data:image/jpeg;base64,aGVsbG8=",
        )

        record = inspection_service.create_inspection(payload)
        media = portal_service.get_evidence_media(record.photo_media_id)

        self.assertEqual(media, ("image/jpeg", b"hello"))
        self.assertEqual(inspection_service.get_inspection_by_id(record.id), record)

    def test_inspection_geofence_accepts_inside_and_flags_outside(self):
        site = schedule_service.get_schedule_by_id("SCH-1001")
        self.assertIsNotNone(site)
        common_fields = {
            "organization": site.organization,
            "location": site.location,
            "date": site.date,
            "time": site.time,
            "inspector": site.inspector,
            "schedule_id": site.id,
            "location_accuracy_m": 5,
        }

        inside = inspection_service.create_inspection(
            InspectionCreate(
                **common_fields,
                latitude=site.site_latitude,
                longitude=site.site_longitude,
                client_submission_id="gps-inside-demo",
            )
        )
        outside = inspection_service.create_inspection(
            InspectionCreate(
                **common_fields,
                latitude=site.site_latitude + 0.005,
                longitude=site.site_longitude,
                client_submission_id="gps-outside-demo",
            )
        )

        self.assertTrue(inside.location_verified)
        self.assertEqual(inside.location_check_status, "verified")
        self.assertFalse(outside.location_verified)
        self.assertEqual(outside.location_check_status, "outside_radius")

    def test_reverse_geocoding_caches_nominatim_address(self):
        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return None

            def read(self):
                return b'{"address":{"house_number":"12","road":"Demo Street","suburb":"Central","city":"Vijayawada","state":"Andhra Pradesh","country":"India"},"display_name":"12, Demo Street, Central, Vijayawada, Andhra Pradesh, India"}'

        previous_request_at = reverse_geocode_service._last_request_at
        reverse_geocode_service._last_request_at = 0
        try:
            with patch("app.services.reverse_geocode_service.urlopen", return_value=FakeResponse()) as open_url:
                result = reverse_geocode_service.reverse_geocode(16.5122047, 80.6842640)
                repeated = reverse_geocode_service.reverse_geocode(16.5122048, 80.6842641)
        finally:
            reverse_geocode_service._last_request_at = previous_request_at

        self.assertEqual(result["road"], "Demo Street")
        self.assertEqual(result["city"], "Vijayawada")
        self.assertEqual(repeated, result)
        open_url.assert_called_once()

    def test_existing_inspection_table_migrates_photo_media_id(self):
        active_path = database.DATABASE_PATH
        active_initialized = database._initialized
        legacy_path = Path(self.temp_directory.name) / "legacy.sqlite3"
        connection = sqlite3.connect(legacy_path)
        try:
            connection.execute(
                """CREATE TABLE inspections (
                    id TEXT PRIMARY KEY, organization TEXT NOT NULL, location TEXT NOT NULL,
                    date TEXT NOT NULL, time TEXT NOT NULL, inspector TEXT NOT NULL,
                    status TEXT NOT NULL, notes TEXT, schedule_id TEXT, latitude REAL,
                    longitude REAL, location_accuracy_m REAL, location_captured_at TEXT,
                    client_submission_id TEXT UNIQUE, location_distance_m REAL,
                    location_verified INTEGER, location_check_status TEXT
                )"""
            )
            connection.execute(
                """CREATE TABLE schedules (
                    id TEXT PRIMARY KEY, organization TEXT NOT NULL, location TEXT NOT NULL,
                    date TEXT NOT NULL, time TEXT NOT NULL, inspector TEXT NOT NULL,
                    status TEXT NOT NULL
                )"""
            )
            connection.execute(
                """INSERT INTO inspections
                (id, organization, location, date, time, inspector, status,
                client_submission_id, location_captured_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    "LEGACY-LIVE-1", "Legacy Demo Org", "Demo Road", "2026-10-06",
                    "10:30 AM", "Ramesh Kadam", "Submitted", "legacy-submission-1",
                    "2026-10-04T14:14:27.901Z",
                ),
            )
            connection.commit()
        finally:
            connection.close()
        try:
            database.DATABASE_PATH = legacy_path
            database._initialized = False
            database.initialize_database()
            with database.get_connection() as connection:
                columns = {row["name"] for row in connection.execute("PRAGMA table_info(inspections)")}
                schedule_columns = {row["name"] for row in connection.execute("PRAGMA table_info(schedules)")}
                migrated = connection.execute(
                    "SELECT date, time, scheduled_date, scheduled_time FROM inspections WHERE id = ?",
                    ("LEGACY-LIVE-1",),
                ).fetchone()
            self.assertIn("photo_media_id", columns)
            self.assertTrue({"site_latitude", "site_longitude", "site_radius_m"}.issubset(schedule_columns))
            self.assertEqual(migrated["date"], "2026-10-04")
            self.assertEqual(migrated["time"], "07:44 PM")
            self.assertEqual(migrated["scheduled_date"], "2026-10-06")
            self.assertEqual(migrated["scheduled_time"], "10:30 AM")
        finally:
            database.DATABASE_PATH = active_path
            database._initialized = active_initialized

    def test_authority_portal_payload_is_seeded_in_database(self):
        payload = portal_service.get_portal_data()

        self.assertEqual(len(payload["organizations"]), 5)
        self.assertEqual(len(payload["inspections"]), 5)
        self.assertEqual(len(payload["cameras"]), 4)
        self.assertIn("dashboard", payload)
        self.assertIn("reports", payload)

    def test_demo_media_and_login_accounts_are_database_backed(self):
        self.assertIsNotNone(portal_service.get_evidence_media("demo-inspection-photo"))
        authority = auth_service.authenticate("authority", "satark123", "Authority Officer")
        self.assertEqual(authority["role"], "authority")
        self.assertIsNone(auth_service.authenticate("authority", "wrong", "Authority Officer"))

    def test_portal_settings_updates_persist(self):
        settings = portal_service.get_portal_data()["settings"]
        settings["displayName"] = "Demo Reviewer"
        portal_service.update_portal_settings(settings)

        self.assertEqual(portal_service.get_portal_data()["settings"]["displayName"], "Demo Reviewer")

    def test_organization_create_is_persisted_in_registry(self):
        organization = organization_service.create_organization(
            OrganizationCreate(
                name="Real Demo Organization",
                location="Demo District",
                address="1 Demo Road, Demo District",
                latitude=18.5,
                longitude=73.8,
                radius_m=150,
            )
        )

        self.assertEqual(organization_service.get_organization_by_id(organization.id), organization)
        self.assertEqual(organization.count, 0)
        self.assertRegex(organization.reg, r"^SD-ORG-[A-F0-9]{12}$")
        self.assertEqual(organization.radius_m, 150)
        self.assertIn(organization, organization_service.get_all_organizations())

    def test_generated_organization_registration_ids_are_unique(self):
        first = organization_service.create_organization(
            OrganizationCreate(
                name="First Generated ID Organization",
                location="Vijayawada",
                address="1 First Road, Vijayawada",
            )
        )
        second = organization_service.create_organization(
            OrganizationCreate(
                name="Second Generated ID Organization",
                location="Vijayawada",
                address="2 Second Road, Vijayawada",
            )
        )

        self.assertNotEqual(first.reg, second.reg)
        self.assertRegex(first.reg, r"^SD-ORG-[A-F0-9]{12}$")
        self.assertRegex(second.reg, r"^SD-ORG-[A-F0-9]{12}$")

    def test_organization_verification_status_is_persisted(self):
        organization = organization_service.create_organization(
            OrganizationCreate(
                name="Organization Review Test",
                location="Vijayawada",
                address="1 Review Road, Vijayawada",
            )
        )
        self.assertEqual(organization.verification, "Pending")

        flagged = organization_service.update_organization_verification(
            organization.id,
            "Flagged",
        )
        self.assertEqual(flagged.verification, "Flagged")
        self.assertEqual(flagged.risk, "High attention")

        database._initialized = False
        database.initialize_database()
        verified = organization_service.update_organization_verification(
            organization.id,
            "Verified",
        )
        self.assertEqual(verified.verification, "Verified")
        self.assertEqual(verified.risk, "Low attention")
        self.assertIsNone(
            organization_service.update_organization_verification(
                "missing-organization",
                "Verified",
            )
        )

    def test_delete_organization_preserves_existing_inspection_and_schedule_history(self):
        organization = organization_service.create_organization(
            OrganizationCreate(
                name="Organization Delete History Test",
                location="Vijayawada",
                address="1 History Road, Vijayawada",
                latitude=16.5122,
                longitude=80.6843,
                radius_m=250,
            )
        )
        inspector = user_service.get_all_users()[0]
        scheduled_date = date.today() + timedelta(days=20)
        schedule = schedule_service.create_scheduled_inspection(
            ScheduleCreate(
                organization_id=organization.id,
                inspector_id=inspector.id,
                date=scheduled_date,
                time="10:30",
            )
        )
        inspection = inspection_service.create_inspection(
            InspectionCreate(
                organization=organization.name,
                location=organization.address,
                date=scheduled_date.isoformat(),
                time=schedule.time,
                inspector=inspector.name,
                schedule_id=schedule.id,
                latitude=organization.latitude,
                longitude=organization.longitude,
                client_submission_id="org-delete-history-test",
            )
        )

        self.assertTrue(organization_service.delete_organization(organization.id))
        self.assertFalse(organization_service.delete_organization(organization.id))
        self.assertIsNone(organization_service.get_organization_by_id(organization.id))
        self.assertEqual(schedule_service.get_schedule_by_id(schedule.id), schedule.model_copy(update={"status": "Completed"}))
        self.assertEqual(inspection_service.get_inspection_by_id(inspection.id), inspection)


if __name__ == "__main__":
    unittest.main()