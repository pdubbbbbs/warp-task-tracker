const { app, BrowserWindow, Menu, ipcMain, Tray, nativeImage } = require('electron');
const path = require('path');
const TaskTracker = require('./TaskTracker');

class ElectronTaskTracker {
  constructor() {
    this.mainWindow = null;
    this.tray = null;
    this.taskTracker = new TaskTracker();
    this.isQuitting = false;
  }

  createMainWindow() {
    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: 450,
      height: 600,
      minWidth: 400,
      minHeight: 500,
      titleBarStyle: 'hiddenInset',
      titleBarOverlay: {
        color: '#1e1e2e',
        symbolColor: '#cdd6f4'
      },
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false
      },
      icon: this.getAppIcon(),
      show: false, // Don't show until ready
      vibrancy: 'under-window',
      transparent: false,
      backgroundColor: '#1e1e2e'
    });

    // Load the HTML file
    this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
    });

    // Handle window close
    this.mainWindow.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.mainWindow.hide();
      }
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.webContents.openDevTools();
    }
  }

  createTray() {
    const trayIcon = this.getAppIcon();
    this.tray = new Tray(trayIcon);
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Warp Task Tracker',
        click: () => {
          this.mainWindow.show();
        }
      },
      {
        label: 'New Task',
        click: () => {
          this.mainWindow.show();
          this.mainWindow.webContents.send('show-new-task-dialog');
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          this.isQuitting = true;
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
    this.tray.setToolTip('Warp Task Tracker');
    
    this.tray.on('click', () => {
      this.mainWindow.isVisible() ? this.mainWindow.hide() : this.mainWindow.show();
    });
  }

  getAppIcon() {
    // Create a simple icon programmatically if no icon file exists
    const canvas = require('canvas');
    const canvasInstance = canvas.createCanvas(64, 64);
    const ctx = canvasInstance.getContext('2d');
    
    // Draw a simple task icon
    ctx.fillStyle = '#89b4fa';
    ctx.fillRect(0, 0, 64, 64);
    
    ctx.fillStyle = '#1e1e2e';
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🎯', 32, 45);
    
    return nativeImage.createFromDataURL(canvasInstance.toDataURL());
  }

  setupIpcHandlers() {
    // Task management IPC handlers
    ipcMain.handle('start-task', async (event, taskName, description) => {
      try {
        await this.taskTracker.startTask(taskName, description);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('update-progress', async (event, percentage, message) => {
      try {
        await this.taskTracker.updateProgress(percentage, message);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('get-current-task', async () => {
      try {
        const data = await this.taskTracker.loadData();
        return { success: true, task: data.currentTask };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('get-task-history', async (event, count = 10) => {
      try {
        const data = await this.taskTracker.loadData();
        return { success: true, history: data.history.slice(0, count) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('complete-task', async (event, message) => {
      try {
        await this.taskTracker.completeTask(message);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('stop-task', async () => {
      try {
        await this.taskTracker.stopTask();
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('get-config', async () => {
      try {
        const config = await this.taskTracker.loadConfig();
        return { success: true, config };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('update-config', async (event, key, value) => {
      try {
        const config = await this.taskTracker.loadConfig();
        config[key] = value;
        await this.taskTracker.saveConfig(config);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Window control handlers
    ipcMain.handle('minimize-window', () => {
      if (this.mainWindow) {
        this.mainWindow.minimize();
      }
    });

    ipcMain.handle('close-window', () => {
      if (this.mainWindow) {
        this.mainWindow.close();
      }
    });
  }

  initialize() {
    // Handle app ready
    app.whenReady().then(() => {
      this.createMainWindow();
      this.createTray();
      this.setupIpcHandlers();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    // Handle all windows closed
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Handle before quit
    app.on('before-quit', () => {
      this.isQuitting = true;
    });
  }
}

// Initialize the app
const electronApp = new ElectronTaskTracker();
electronApp.initialize();

module.exports = ElectronTaskTracker;
