const { app, BrowserWindow } = require('electron');
const path = require('path');
const serveExport = require('electron-serve');
const serve = serveExport.default || serveExport;

const loadURL = serve({ directory: 'dist' });

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Control de MP - Multi Steel",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../assets/splash-icon.png')
  });

  win.setMenuBarVisibility(false);

  const isDev = !app.isPackaged;

  if (isDev) {
    console.log("Running in DEV mode");
    win.loadURL('http://localhost:8081');
    win.webContents.openDevTools();
  } else {
    console.log("Running in PROD mode");
    // Usar electron-serve para cargar la app desde la carpeta 'dist'
    loadURL(win);
    // DEBUG: Habilitar DevTools en producción para ver errores
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
