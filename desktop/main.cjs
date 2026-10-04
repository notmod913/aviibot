const { app, BrowserWindow, dialog, Menu, session, shell } = require("electron");

let mainWindow;
let localServers;
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

function installMenu(urls) {
  const template = [
    {
      label: "Satark Drishti",
      submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }],
    },
  ];

  if (!app.isPackaged) {
    template.push({
      label: "Workspace",
      submenu: [
        { label: "Authority Dashboard", accelerator: "Alt+1", click: () => mainWindow?.loadURL(urls.dashboardUrl) },
        { label: "Inspector Portal", accelerator: "Alt+2", click: () => mainWindow?.loadURL(urls.inspectorUrl) },
        { type: "separator" },
        { role: "reload" },
        { role: "toggleDevTools" },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(urls) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 900,
    minHeight: 640,
    title: "Satark Drishti",
    backgroundColor: "#f7f8f6",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const externalUrl = new URL(url);
      if (["https:", "mailto:"].includes(externalUrl.protocol)) {
        void shell.openExternal(url);
      }
    } catch {
      // Invalid external URLs are denied.
    }
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    try {
      const nextUrl = new URL(url);
      if (nextUrl.protocol !== "http:" || !new Set(["127.0.0.1:4175", "127.0.0.1:4176"]).has(nextUrl.host)) {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (!app.isPackaged || input.type !== "keyDown") return;
    const key = input.key.toLowerCase();
    if (key === "f12" || ((input.control || input.meta) && input.shift && ["i", "j", "c"].includes(key))) {
      event.preventDefault();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
  installMenu(urls);
  void mainWindow.loadURL(urls.dashboardUrl);
}

if (hasSingleInstanceLock) {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      let inspectorOrigin = false;
      try {
        inspectorOrigin = webContents === mainWindow?.webContents && new URL(webContents.getURL()).origin === "http://127.0.0.1:4176";
      } catch {
        inspectorOrigin = false;
      }
      callback(permission === "geolocation" && inspectorOrigin);
    });

    try {
      const { startDesktopServers } = await import("./http-server.mjs");
      localServers = await startDesktopServers();
      createWindow(localServers);
    } catch (error) {
      console.error(error);
      await dialog.showMessageBox({
        type: "error",
        title: "Satark Drishti could not start",
        message: "The desktop app could not open its local web services.",
        detail: `${error.message}\n\nMake sure ports 4175 and 4176 are available, then restart the app.`,
      });
      app.quit();
    }
  });
}

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && localServers) createWindow(localServers);
});

app.on("before-quit", () => {
  localServers?.close();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});