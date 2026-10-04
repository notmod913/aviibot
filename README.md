# Satark-Drishti
Database to store the data of NGO, Inspectors, Inspection Details, Latitude/Longitude

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
