import tempfile
import unittest
from pathlib import Path

from app import database
from app.schemas.inspection import InspectionCreate
from app.services import auth_service, inspection_service, portal_service, schedule_service, user_service


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

        generated = schedule_service.generate_random_schedule(2)
        database.initialize_database()

        self.assertEqual(len(generated), 2)
        self.assertEqual(len(schedule_service.get_all_schedules()), 4)

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


if __name__ == "__main__":
    unittest.main()