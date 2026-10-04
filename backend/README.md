# Satark Drishti — Backend (Member 3)

This folder contains **only Member 3's scope**: an independent FastAPI
backend with persistent SQLite demo data. It can later migrate to:

- **Member 2** — Inspector Portal (React), as an API consumer
- **Member 4** — PostgreSQL + PostGIS, as a production storage layer
- **Member 1** — Authority Website, as another API consumer

## Technologies used

- Python
- FastAPI
- Pydantic (data validation / schemas)
- SQLite (persistent local demo database; Python standard library)
- Uvicorn (ASGI server)
- python-dotenv (loads `.env` for configuration such as CORS origins)

Data routes require a configured bearer token. User identity, password
management, and role-based permissions still require a production identity
provider and database.

## Folder structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI app, CORS, health check, router mounting
│   ├── database.py              # SQLite connection, schema, and idempotent demo seed
│   ├── api/
│   │   ├── router.py             # combines all route modules under /api
│   │   └── routes/
│   │       ├── users.py
│   │       ├── schedules.py
│   │       └── inspections.py
│   ├── schemas/
│   │   ├── user.py
│   │   ├── schedule.py
│   │   └── inspection.py
│   ├── services/
│       ├── user_service.py       # SQLite user queries
│       ├── schedule_service.py   # SQLite schedules + generator
│       └── inspection_service.py # SQLite inspection records
├── requirements.txt
├── .env.example
└── README.md
```

`schemas/` defines the shape of API data (Pydantic models). `services/`
contains the database queries and business logic. `api/routes/` defines
the HTTP endpoints and stays thin by calling into `services/`.

## APIs available

All routes are mounted under `/api`.

| Method | Path                     | Description                                   |
|--------|--------------------------|------------------------------------------------|
| GET    | `/api/health`            | Liveness check → `{"status": "ok"}`            |
| GET    | `/api/portal-data`       | Authority dashboard demo payload                 |
| POST   | `/api/auth/login`        | Verify a demo account and return an expiring session |
| PUT    | `/api/portal-data/settings` | Save authority profile and preferences         |
| GET    | `/api/media/{media_id}`  | Load evidence image BLOB from SQLite             |
| GET    | `/api/users`             | List demo users/inspectors (Bearer token required) |
| GET    | `/api/users/{user_id}`   | Get one demo user by id (Bearer token required) |
| GET    | `/api/schedule`          | List demo schedules (Bearer token required)     |
| POST   | `/api/schedule/generate` | Generate demo schedules (Bearer token required) |
| GET    | `/api/inspections`       | List demo inspections (Bearer token required)   |
| GET    | `/api/inspections/{id}`  | Get one demo inspection (Bearer token required) |
| POST   | `/api/inspections`       | Create a demo inspection (Bearer token required)|

Authority review actions persist with `PUT /api/inspections/{id}/status`
(`Verified` or `Flagged`), and any persisted inspection can be deleted with
`DELETE /api/inspections/{id}`. Deletion tombstones prevent seeded records from
being recreated at the next backend startup.

Interactive Swagger documentation is available at **`/docs`** outside
production. It is disabled when `APP_ENV=production`.

The organization registry API includes `GET /api/organizations`,
`GET /api/organizations/{id}`, and `POST /api/organizations`. New entries and
their site boundaries are stored in SQLite and are available to the random
schedule generator.

`GET /api/location/reverse?latitude=...&longitude=...` uses OpenStreetMap
Nominatim to look up a nearby mapped street or place and locality. Coordinates
are rounded to five decimal places before lookup, and successful results are
cached in SQLite with requests rate-limited to Nominatim's public-service policy.
Captured coordinates are sent to the public Nominatim service for this lookup.
The address is approximate map data and is displayed separately from the
organization's registered location.

## Demo data notice

The backend creates `data/satark.sqlite3` on first startup and seeds three
inspectors, two schedules, five primary inspection/evidence examples, 30 fictional
historical inspection records for populated charts, eleven fictional organizations
across the authority registry and scheduled field sites, chart/report data, timeline
events, camera status, and one evidence image BLOB. The authority payload is served by
`/api/portal-data`; inspector schedules and inspection records use their normal
endpoints. Authority charts and report summaries are derived from the same
persisted inspection collection. Generated schedules and submitted inspections
persist across restarts. Deleted inspection IDs are tombstoned so seeded rows
stay deleted. All seeded records are fictional demo data, not real government or
NGO information.

## How to run

1. Create and activate a virtual environment:

   ```
   python -m venv .venv
   ```

   - Windows: `.venv\Scripts\activate`
   - macOS/Linux: `source .venv/bin/activate`

2. Install requirements:

   ```
   pip install -r requirements.txt
   ```

3. Copy `.env.example` to `.env`. For production or non-local API access,
   generate a unique `API_ACCESS_TOKEN`; adjust `DATABASE_PATH`,
   `ALLOWED_ORIGINS`, and `TRUSTED_HOSTS` as needed.

4. Run the server:

   ```
   uvicorn app.main:app --reload
   ```

5. Open Swagger docs at:

   ```
   http://127.0.0.1:8000/docs
   ```

Run the backend persistence tests from the `backend/` directory:

```powershell
python -m unittest discover -s tests
```

## CORS

The API allows browser requests from the Inspector Portal's local dev
server by default:

- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `http://localhost:5174`
- `http://127.0.0.1:5174`
- `http://localhost:4175`
- `http://127.0.0.1:4175`
- `http://localhost:4176`
- `http://127.0.0.1:4176`

This list is read from `ALLOWED_ORIGINS` in `.env` (comma-separated), and
falls back to the local dashboard and inspector portal origins above if not set.
Wildcard origins are rejected, credentials are not allowed, and only the
`Authorization` and `Content-Type` request headers are accepted.

## API authentication

The login endpoint verifies backend-stored salted PBKDF2 hashes and does not
return or store passwords in the frontend. Other `/api` data routes are
protected. In development, loopback requests are allowed without a token so
the local portals can call the API. Outside development, configure
`API_ACCESS_TOKEN` with at least 32 characters; requests must send
`Authorization: Bearer <API_ACCESS_TOKEN>`. Tokens are compared in constant
time. An unconfigured production token fails closed with HTTP 503; invalid or
missing tokens receive HTTP 401. The health endpoint remains public.
Never commit `.env` or reuse the desktop demo credentials as this API token.

Example request after configuring the token. Replace the placeholder with
the value from your local `.env` file:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/schedule -Headers @{
   Authorization = "Bearer YOUR_CONFIGURED_API_TOKEN"
}
```

## GPS boundary checks

The Inspector Portal captures browser-provided coordinates and sends them
with the inspection submission. Seeded demo schedules include fictional
site coordinates and a 100 m radius so the boundary check can be demonstrated
locally. Replace them with verified site coordinates in `SITE_LOCATIONS_JSON`
for deployment; keys must match the organization names exactly. For example:

```dotenv
SITE_LOCATIONS_JSON={"Asha Bal Vikas Sanstha":{"latitude":18.5074,"longitude":73.8077,"radius_m":100}}
```

Replace the example coordinates with verified site coordinates. Environment
values override the demo schedule coordinates. The API returns
`location_distance_m`, `location_verified`, and a check status when a
configured site, schedule, and coordinate pair are available. This is a
proximity calculation, not proof against GPS spoofing; browser location and
camera data can be manipulated on unmanaged devices.
The browser must be served from HTTPS or localhost for geolocation access.

Inspection submissions accept `schedule_id`, `latitude`, `longitude`,
`location_accuracy_m`, `location_captured_at`, and
`client_submission_id`. The client ID has a SQLite uniqueness constraint,
so retried submissions return the existing record across server restarts.

## Intentionally NOT implemented yet

The following still require separate implementation or deployment:

- PostgreSQL / PostGIS production migration (Member 4's responsibility)
- Production identity provider, password reset, and role-based API authorization
- Verified NGO/organization registry integration
- CCTV source provisioning, production MediaMTX security, TLS, and network rules
- Hardware-backed camera/GPS attestation; browser permissions alone cannot prove capture authenticity
- AI/ML features
- Notifications
- Analytics or reports

The main Inspector flow caches schedules and queues photo/GPS submissions in
IndexedDB, then retries through `POST /api/inspections` when connectivity
returns. The Authority dashboard can display MediaMTX WebRTC streams when a
source is configured; streaming is not served by this FastAPI backend. All
seeded organizations, sites, schedules, inspections, and evidence are
fictional demonstration data.

The service layer (`app/services/`) is deliberately isolated from the
route layer so the SQLite implementation can later be replaced with
PostgreSQL/PostGIS without changing the API route or response contracts.
