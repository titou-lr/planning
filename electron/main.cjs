const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const fs = require('fs')

const DEV_URL = process.env.VITE_DEV_SERVER_URL
// Mode capture : SCREENSHOT_PATH=... [SCREENSHOT_ROUTE=...] → capture puis quitte.
const SCREENSHOT_PATH = process.env.SCREENSHOT_PATH

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#010102',
    autoHideMenuBar: true,
    // Fenêtre visible même en mode capture : capturePage sur fenêtre cachée
    // omet les couches composées (backdrop-filter des overlays)
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Liens externes → navigateur système, jamais dans l'app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (DEV_URL) {
    win.loadURL(DEV_URL)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  if (SCREENSHOT_PATH) {
    let timer = null
    // Le script de seed peut recharger la page : on ne capture qu'après le dernier load
    win.webContents.on('did-finish-load', () => {
      if (timer) clearTimeout(timer)
      const script = process.env.SCREENSHOT_SCRIPT_FILE
        ? fs.readFileSync(process.env.SCREENSHOT_SCRIPT_FILE, 'utf8')
        : process.env.SCREENSHOT_SCRIPT || ''
      const run = script
        ? win.webContents.executeJavaScript(script).then(
            (v) => console.log('[screenshot] script →', v),
            (e) => console.error('[screenshot] script error:', e && e.message)
          )
        : Promise.resolve()
      run.then(() => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(async () => {
          try {
            const img = await win.webContents.capturePage()
            fs.writeFileSync(SCREENSHOT_PATH, img.toPNG())
          } finally {
            app.quit()
          }
        }, Number(process.env.SCREENSHOT_DELAY || 1200))
      })
    })
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
