# Camera and Evidence Integration

## Inspector capture

The Inspector role is available from the main frontend on port `5173`. Choose a scheduled visit, select **Start inspection**, then capture a photo and GPS position from the browser. Camera and geolocation permissions are required; browser access works on `localhost` or HTTPS.

Schedules are cached in IndexedDB. If the backend is unavailable, the Inspector can still capture evidence; photo, coordinates, notes, and a stable retry ID are saved locally. The app retries queued submissions on reconnect, app startup, and periodically while open. Submitted JPEG/PNG/WebP images and inspection details are stored in SQLite; images are served at `/api/media/{photo_media_id}`. Existing databases migrate schedule boundaries and evidence references on startup.

Authority users can review submitted photos and GPS data on **Evidence Verification**. Geofence checks use the schedule's registered coordinates and radius. Demo coordinates and organizations are fictional examples; replace them with verified site registry data. Browser GPS and browser camera access are not tamper-proof.

## Authority CCTV / WebRTC

Larix Broadcaster can publish RTMP to MediaMTX, and browser playback uses MediaMTX WHEP over WebRTC. The Authority **Live Monitoring** page includes a default `live/entrance` viewer and accepts additional WHEP endpoint settings stored in that browser.

The local MediaMTX configuration is `camera/mediamtx.yml`. RTMP ingest and WebRTC signaling/media bind to network interfaces so a phone on the same private Wi-Fi can reach the PC. RTSP remains loopback-only. Larix needs both an application and a stream name: configure RTMP server `rtmp://<PC-LAN-IP>:1935/live` and stream name/key `entrance` (full URL: `rtmp://<PC-LAN-IP>:1935/live/entrance`). Find the PC IPv4 address with `ipconfig`. Start the whole project with `npm run start:all`, allow MediaMTX through Windows Firewall on **Private networks** if prompted, then start broadcasting in Larix. Open the dashboard at `http://localhost:5173/live-monitoring` on the PC and click **Reconnect** if Larix was started after the page; the viewer uses `http://localhost:8889/live/entrance/whep`.

- Larix RTMP ingest: TCP `1935`
- WHEP signaling: HTTP `8889`
- WebRTC media: UDP `8189`
- Optional RTSP ingest: TCP `8554` (loopback only)

Run a MediaMTX Windows binary with this config from the project root:

```powershell
& "$env:LOCALAPPDATA\SatarkDrishti\MediaMTX-v1.21.1\mediamtx.exe" ".\camera\mediamtx.yml"
```

The MediaMTX executable is not committed to the repository. This configuration does not create camera footage: Larix (or another authorized source) must publish to MediaMTX before video appears. RTMP is unauthenticated in this local demo configuration; use only a trusted private network and never port-forward these ports or expose them to the internet. Production requires publisher/viewer authentication, TLS, origin restrictions, firewall rules, and appropriate ICE/TURN settings.