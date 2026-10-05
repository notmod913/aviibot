# Satark Drishti — Inspector Portal (Member 2)

React + Vite Inspector Portal for Satark Drishti. This is a website section/portal, not a separate Flutter app.

## Connected to Member 3

The portal now consumes the FastAPI backend at `http://localhost:8000` by default.

- `GET /api/schedule` — inspection schedule
- `GET /api/inspections` — inspection records
- `GET /api/inspections/{id}` — record detail
- `POST /api/inspections` — submit an inspection record

Set `VITE_API_BASE_URL` in `.env` if the backend runs somewhere else. See `.env.example`.

## Current screens

- Inspection Schedule
- Inspection Details
- On-Site Inspection workflow
- Inspection Records
- Inspection Record Detail

## Inspector workflow

The five route pages in `src/pages/` are mounted by the main application on port `5173` when an Inspector signs in. The flow is Schedule → Inspection Details → On-Site Inspection → Inspection Records → Inspection Record Detail.

On-site inspection captures a photo directly from the browser camera, obtains GPS and accuracy, and submits the evidence to the FastAPI backend. Schedules and unsent inspections use IndexedDB; queued submissions retry when the browser reconnects. GPS boundaries use demo coordinates by default and must be replaced with verified site locations for deployment.

Live CCTV is shown in the Authority portal through MediaMTX WebRTC/WHEP. A real camera source, credentials, and production network/security configuration are not included. Neither browser GPS nor browser camera capture alone provides hardware-backed proof against spoofing.

## Run

```powershell
npm install
npm run dev
```

The FastAPI backend must be running for live schedule/record data:

```powershell
cd ..\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The main project root already mounts these pages at `http://localhost:5173`; no second frontend is required for the integrated workflow. To run this package independently for development, install its dependencies and run `npm run dev` from `inspector-portal` while the root frontend is stopped.
