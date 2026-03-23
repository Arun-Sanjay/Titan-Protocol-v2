const { app, BrowserWindow, Tray, Menu, nativeImage } = require("electron");
const path = require("path");

let mainWindow = null;
let tray = null;

const STATIC_DIR = path.join(__dirname, "..", "out");

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    center: true,
    title: "Titan Protocol",
    icon: path.join(__dirname, "..", "src-tauri", "icons", "icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(STATIC_DIR, "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, "..", "src-tauri", "icons", "icon.png")
  );
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Titan Protocol",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);

  tray.setToolTip("Titan Protocol");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on("window-all-closed", () => {
  // Keep running in tray on Windows
  if (process.platform !== "win32") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
