# Feature Integration Notes

## Inspector location and offline queue

- The Inspector Portal reads device location from the browser Geolocation API. Serve it from `localhost` or HTTPS and grant location permission.
- The inspection form sends `schedule_id`, `latitude`, `longitude`, `location_accuracy_m`, and `location_captured_at` to `POST /api/inspections`.
- The backend's development CORS defaults allow the dashboard on port 5173 and inspector portal on port 5174.
- Configure real registered sites in `backend/.env` with `SITE_LOCATIONS_JSON`. Keys must exactly match the organization names in the schedule. Each value has `latitude`, `longitude`, and `radius_m`.
- The backend calculates distance and the radius result. A missing target location returns `location_verified: null`. Browser geolocation is not tamper-proof.
- IndexedDB caches schedules and stores queued inspections. On reconnect, submissions retry with a stable `client_submission_id`. The current backend de-duplicates only within one process lifetime; persist this key with a database unique constraint before production use.
- API and schedule storage are still in memory. A backend restart discards submitted records and resets the in-memory idempotency index.

## Authority live monitoring

1. Start MediaMTX and publish/ingest the source stream there. RTSP is an ingest/source protocol; the browser viewer uses WebRTC over MediaMTX WHEP.
2. Copy the root `.env.example` to `.env` and set `VITE_LIVE_STREAMS` to a JSON array. Each item has `name`, `organization`, and `whepUrl`, for example `http://localhost:8889/entrance/whep`.
3. Allow the dashboard origin in MediaMTX CORS settings and configure WebRTC ICE hosts/ports so the browser can reach the stream. Use HTTPS for deployed dashboards and WHEP endpoints.
4. Restart Vite after changing `.env`. The `/live-monitoring` route opens configured streams and reports connection failures.

This repository does not provision MediaMTX, CCTV credentials, TLS, access control, or network/firewall rules. Configure those at the deployment boundary. Camera capture from the inspector device is intentionally not included.