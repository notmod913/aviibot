"""SQLite persistence for the demo backend."""

import os
import json
import hashlib
import secrets
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from threading import Lock
from typing import Iterator

from dotenv import load_dotenv
from app.portal_demo_seed import DEMO_ACCOUNTS, PORTAL_DEMO_DATA

load_dotenv()

DEFAULT_DATABASE_PATH = Path(__file__).resolve().parents[1] / "data" / "satark.sqlite3"
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", str(DEFAULT_DATABASE_PATH))).expanduser()
_initialization_lock = Lock()
_initialized = False

_DEMO_USERS = (
    (1, "Ramesh Kadam", "Field Inspector", "Pune Division"),
    (2, "Sunita Patil", "Field Inspector", "Nashik Division"),
    (3, "Arjun Deshmukh", "Senior Inspector", "Pune Division"),
)

_DEMO_SCHEDULES = (
    ("SCH-1001", "Asha Bal Vikas Sanstha", "Kothrud, Pune", "2026-09-29", "10:30 AM", "Ramesh Kadam", "Scheduled"),
    ("SCH-1002", "Sanjeevani Old Age Support Trust", "Hadapsar, Pune", "2026-09-29", "02:00 PM", "Ramesh Kadam", "Scheduled"),
)

_DEMO_INSPECTIONS = (
    ("REC-1001", "Nirmal Jeevan Foundation", "Kondhwa, Pune", "2026-09-18", "10:00 AM", "Ramesh Kadam", "Verified", "Records and facilities found in order.", None, None, None, None, None, None, None, None, "not_configured"),
)


def _initialize_connection(connection: sqlite3.Connection) -> None:
    global _initialized
    if _initialized:
        return

    with _initialization_lock:
        if _initialized:
            return

        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                designation TEXT NOT NULL,
                region TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS schedules (
                id TEXT PRIMARY KEY,
                organization TEXT NOT NULL,
                location TEXT NOT NULL,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                inspector TEXT NOT NULL,
                status TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);
            CREATE TABLE IF NOT EXISTS inspections (
                id TEXT PRIMARY KEY,
                organization TEXT NOT NULL,
                location TEXT NOT NULL,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                inspector TEXT NOT NULL,
                status TEXT NOT NULL,
                notes TEXT,
                schedule_id TEXT,
                latitude REAL,
                longitude REAL,
                location_accuracy_m REAL,
                location_captured_at TEXT,
                client_submission_id TEXT UNIQUE,
                location_distance_m REAL,
                location_verified INTEGER,
                location_check_status TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections(date);
            CREATE TABLE IF NOT EXISTS portal_data (
                data_key TEXT PRIMARY KEY,
                payload TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS portal_settings (
                setting_id INTEGER PRIMARY KEY CHECK (setting_id = 1),
                payload TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS accounts (
                username TEXT PRIMARY KEY,
                role TEXT NOT NULL,
                display_name TEXT NOT NULL,
                password_salt TEXT NOT NULL,
                password_hash TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS evidence_media (
                media_id TEXT PRIMARY KEY,
                media_type TEXT NOT NULL,
                content BLOB NOT NULL
            );
            """
        )
        connection.executemany(
            "INSERT OR IGNORE INTO users (id, name, designation, region) VALUES (?, ?, ?, ?)",
            _DEMO_USERS,
        )
        connection.executemany(
            "INSERT OR IGNORE INTO schedules (id, organization, location, date, time, inspector, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
            _DEMO_SCHEDULES,
        )
        connection.executemany(
            """INSERT OR IGNORE INTO inspections (
                id, organization, location, date, time, inspector, status, notes,
                schedule_id, latitude, longitude, location_accuracy_m,
                location_captured_at, client_submission_id, location_distance_m,
                location_verified, location_check_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            _DEMO_INSPECTIONS,
        )
        connection.execute(
            "INSERT OR IGNORE INTO portal_data (data_key, payload) VALUES (?, ?)",
            ("demo", json.dumps(PORTAL_DEMO_DATA)),
        )
        connection.execute(
            "INSERT OR IGNORE INTO portal_settings (setting_id, payload) VALUES (?, ?)",
            (1, json.dumps(PORTAL_DEMO_DATA["settings"])),
        )
        for username, role, display_name, password in DEMO_ACCOUNTS:
            existing_account = connection.execute(
                "SELECT username FROM accounts WHERE username = ?",
                (username,),
            ).fetchone()
            if existing_account is None:
                salt = secrets.token_bytes(16)
                password_hash = hashlib.pbkdf2_hmac(
                    "sha256", password.encode("utf-8"), salt, 310_000
                ).hex()
                connection.execute(
                    """INSERT INTO accounts
                    (username, role, display_name, password_salt, password_hash)
                    VALUES (?, ?, ?, ?, ?)""",
                    (username, role, display_name, salt.hex(), password_hash),
                )
        demo_photo = Path(__file__).resolve().parents[2] / "src" / "assets" / "inspection-evidence.jpg"
        if demo_photo.is_file():
            connection.execute(
                "INSERT OR IGNORE INTO evidence_media (media_id, media_type, content) VALUES (?, ?, ?)",
                ("demo-inspection-photo", "image/jpeg", demo_photo.read_bytes()),
            )
        connection.commit()
        _initialized = True


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH, timeout=10)
    try:
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 10000")
        connection.execute("PRAGMA journal_mode = WAL")
        _initialize_connection(connection)
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database() -> None:
    with get_connection():
        pass