# Satark Drishti companion apps

This folder contains a Windows desktop installer build, a LAN launcher, and an
Android companion app. The existing web app source is not modified.

## Build the Windows installer

From PowerShell, run:

```powershell
.\downloadable-app\windows\build-windows.ps1
```

The script builds both web portals and packages the existing Electron desktop
shell as a Windows installer under `downloadable-app\releases\windows`. The
installer runs the user interface on the laptop. It requires the FastAPI
backend to be running at `http://127.0.0.1:8000` for live, shared inspection
data; this installer does not bundle Python or the backend. Use the LAN
launcher below when the laptop is also serving connected phones.

## Windows laptop serving Android phones

The laptop runs the existing app and remains the shared database/API host. From
PowerShell, run:

```powershell
.\downloadable-app\windows\start-lan.ps1
```

Prerequisites are the project dependencies, the backend virtual environment,
and built frontend assets:

- `npm install` has been run in the project root.
- `backend\.venv\Scripts\python.exe` exists.
- `npm run build` and `npm run build --prefix inspector-portal` have completed.

The script starts the FastAPI backend, the existing Windows desktop app, and
LAN-only web bridges. It prints the laptop's Wi-Fi URLs:

- Authority web app: `http://<laptop-ip>:5173`
- Inspector web app: `http://<laptop-ip>:5174`

Keep this PowerShell window open while phones use the app. Press Ctrl+C to stop
the processes started by the script. Windows Firewall may ask whether to allow
private-network access; allow it only on a trusted Wi-Fi network. Do not expose
these development services to public networks.

The API is shared by phones that connect to the same Wi-Fi network; it is not
hosted on each phone. The Windows host must remain on and connected.

## Android

Open `downloadable-app\android` in Android Studio, install the Android SDK
requested by the project, and build/install the `app` debug variant. On the
phone, connect to the same trusted Wi-Fi as the laptop, open the app, and enter
one of the Wi-Fi URLs printed by the Windows launcher. The app remembers the
last address.

The Android SDK is not installed in the current development environment, so an
APK cannot be built here. This folder contains the Android Studio project
sources.

## Important mobile limitations

The unmodified web app uses browser camera and location APIs. Android and
modern browsers require a secure HTTPS origin for these APIs; a private
`http://<laptop-ip>` address is not secure. The Android shell requests native
camera/location permissions, but those permission prompts cannot make an
insecure web origin eligible for browser camera or geolocation. Inspection
capture and GPS may therefore be unavailable in this LAN-only, no-source-change
setup. Reliable mobile capture requires HTTPS or app-specific integration in
the web app; neither is added here.

The laptop URLs provide local-network access to the existing development
build. They are intended for a trusted private Wi-Fi network, not internet
hosting.
