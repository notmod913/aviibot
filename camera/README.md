# Camera and CCTV Module

The active inspector photo and GPS workflow is integrated into the main React application. The original `Index.html` remains a standalone browser-capture prototype.

`mediamtx.yml` configures the local MediaMTX gateway for RTSP ingest (`8554`), WHEP signaling (`8889`), and WebRTC media (`8189/UDP`). It binds to localhost and allows the main frontend origins only. A MediaMTX executable and an authorized CCTV source are required for actual live video.

From the project root, run the locally installed MediaMTX binary with:

```powershell
& "$env:LOCALAPPDATA\SatarkDrishti\MediaMTX-v1.21.1\mediamtx.exe" ".\camera\mediamtx.yml"
```

After publishing a camera source to a path such as `entrance`, configure `http://localhost:8889/entrance/whep` on the Authority **Live Monitoring** page. Do not expose this local development configuration to untrusted networks.
