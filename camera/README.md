# Camera and CCTV Module

The active inspector photo and GPS workflow is integrated into the main React application. The original `Index.html` remains a standalone browser-capture prototype.

`mediamtx.yml` configures the local MediaMTX gateway for Larix RTMP ingest (`1935`), WHEP signaling (`8889`), and WebRTC media (`8189/UDP`). RTMP and WebRTC bind to network interfaces for use by a phone on the same trusted Wi-Fi. RTSP ingest (`8554`) remains loopback-only. A MediaMTX executable and an authorized camera publisher are required for actual live video.

From the project root, run the locally installed MediaMTX binary with:

```powershell
& "$env:LOCALAPPDATA\SatarkDrishti\MediaMTX-v1.21.1\mediamtx.exe" ".\camera\mediamtx.yml"
```

Start the project with `npm run start:all`. In Larix, set the RTMP server to `rtmp://<PC-LAN-IP>:1935/live` and stream name/key to `entrance` (full URL: `rtmp://<PC-LAN-IP>:1935/live/entrance`; get the PC IPv4 address with `ipconfig`). Keep the phone and PC on the same Wi-Fi. The Authority **Live Monitoring** page is preconfigured to view `http://localhost:8889/live/entrance/whep`; if you start Larix after opening the page, select **Reconnect**. Allow MediaMTX through Windows Firewall on Private networks if prompted. RTMP publishing has no authentication in this local demo configuration: use only a trusted private network and do not port-forward it or expose it to the internet.
