# Satark-Drishti
Database to store the data of NGO, Inspectors, Inspection Details, Latitude/Longitude

## Local web application

Use Node.js `22.12` or newer. From the project root, run `npm install` once, then start the Authority/Inspector web app, FastAPI backend, and MediaMTX together with `npm run start:all`. The portals share `http://localhost:5173`, and the API runs on `http://localhost:8000`. Press **Ctrl+C** to stop all servers. The launcher expects the backend virtual environment at `backend/.venv` and MediaMTX at `%LOCALAPPDATA%\\SatarkDrishti\\MediaMTX-v1.21.1\\mediamtx.exe`; set `MEDIA_MTX_PATH` if it is installed elsewhere.

The Inspector workflow captures browser camera photos and GPS evidence, queues submissions in IndexedDB when offline, and retries them when connectivity returns. Authority **Inspections** shows saved schedules and inspection reports in one table; a report updates its linked schedule. **Inspection Scheduling** creates persisted assignments by selecting a registered organization and inspector and setting a date and time. The organization’s registered address and GPS boundary are attached to the assignment. The Dashboard’s recent-inspection list and charts use persisted inspection records, including 30 explicitly fictional historical samples for a populated demo. **Organizations** supports registry entries with linked inspection history. Submissions use their actual capture/submission date and time separately from the scheduled slot. For CCTV, run MediaMTX via `npm run start:all`, then publish from Larix to `rtmp://<PC-LAN-IP>:1935/live/entrance`; the Live Monitoring page uses WHEP HTTP `8889` and WebRTC ICE UDP `8189`. See [Integration/README.md](Integration/README.md) for same-Wi-Fi setup and security limitations.

## Windows desktop app

The Electron desktop shell opens the Authority Dashboard on launch. Use the
native **Workspace** menu to switch to the Inspector Portal. The desktop host
serves both production builds locally on `127.0.0.1:4175` and
`127.0.0.1:4176` so browser storage stays available between launches.

For local development, install dependencies once with `npm install`, then run
`npm run desktop:dev`. This opens the currently built frontends in a desktop
window. To create a Windows installer, run `npm run desktop:package`; the
installer is written to `desktop-app/`.

The FastAPI backend is still a separate prerequisite. Install Python, set up
and run the backend as described in [backend/README.md](backend/README.md) so
API-backed inspector schedules, submissions, and authority sync can work. The
desktop frontend alone can open without it, but cannot persist inspection
records across backend restarts. Live video additionally needs an authorized
MediaMTX WHEP stream configured before building the desktop package.
