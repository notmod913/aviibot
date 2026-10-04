# Camera and Evidence Integration

## Inspector capture

The Inspector role is available from the main frontend on port `5173`. Choose a scheduled visit, select **Start inspection**, then capture a photo and GPS position from the browser. Camera and geolocation permissions are required; browser access works on `localhost` or HTTPS.

Schedules are cached in IndexedDB. If the backend is unavailable, the Inspector can still capture evidence; photo, coordinates, notes, and a stable retry ID are saved locally. The app retries queued submissions on reconnect, app startup, and periodically while open. Submitted JPEG/PNG/WebP images and inspection details are stored in SQLite; images are served at `/api/media/{photo_media_id}`. Existing databases migrate schedule boundaries and evidence references on startup.

Authority users can review submitted photos and GPS data on **Evidence Verification**. Geofence checks use the schedule's registered coordinates and radius. Demo coordinates and organizations are fictional examples; replace them with verified site registry data. Browser GPS and browser camera access are not tamper-proof.

## Authority CCTV / WebRTC

RTSP is the camera ingest protocol. Browser playback uses MediaMTX WHEP over WebRTC. The Authority **Live Monitoring** page accepts authorized WHEP endpoint settings and stores them in that browser. Example: `http://localhost:8889/entrance/whep`.

The local MediaMTX configuration is `camera/mediamtx.yml`. It binds to loopback only. For a camera/publisher that pushes RTSP, publish to `rtsp://localhost:8554/entrance`. For an IP camera that serves RTSP, replace the commented `entrance.source` example with the camera's real RTSP URL and set `sourceOnDemand: true`; keep credentials out of committed files. The RTSP path must stay `entrance` to match the WHEP viewer URL:

- RTSP ingest: TCP `8554`
- WHEP signaling: HTTP `8889`
- WebRTC media: UDP `8189`

Run a MediaMTX Windows binary with this config from the project root:

```powershell
& "$env:LOCALAPPDATA\SatarkDrishti\MediaMTX-v1.21.1\mediamtx.exe" ".\camera\mediamtx.yml"
```

The MediaMTX executable is not committed to the repository. This configuration does not create camera footage: publish an authorized CCTV source to MediaMTX (for example, an RTSP camera at `rtsp://localhost:8554/entrance`) before adding the matching WHEP URL in the dashboard. Do not expose this loopback development configuration to a network; production requires credentials, TLS, origin restrictions, firewall rules, and appropriate ICE/TURN settings.