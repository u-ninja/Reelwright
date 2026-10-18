import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { spawn } from 'child_process'
import { once } from 'events'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  load(mainWindow)
}

// HMR for renderer base on electron-vite cli.
// Load the remote URL for development or the local html file for production.
function load(win: BrowserWindow, hash = ''): Promise<void> {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return win.loadURL(process.env['ELECTRON_RENDERER_URL'] + (hash && '#' + hash))
  }
  return win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
}

// shortcut: Homebrew ffmpeg path, bundle ffmpeg in milestone 9.
const FFMPEG = process.env['FFMPEG'] ?? '/opt/homebrew/bin/ffmpeg'
const FPS = 30

// Seek the Player frame by frame in an offscreen window and pipe raw frames into ffmpeg.
async function render(): Promise<string> {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: false,
    webPreferences: { offscreen: true, backgroundThrottling: false }
  })
  const out = join(app.getPath('videos'), `reelwright-${Date.now()}.mp4`)
  let ff: ReturnType<typeof spawn> | undefined
  let log = ''
  try {
    await load(win, 'render')
    const wc = win.webContents
    const duration: number = await wc.executeJavaScript(
      'new Promise(r => { const c = () => window.__seek ? r(window.__duration) : setTimeout(c, 10); c() })'
    )
    const started = Date.now()
    for (let i = 0; i < Math.round(duration * FPS); i++) {
      await wc.executeJavaScript(`__seek(${i / FPS})`)
      const img = await wc.capturePage()
      if (!ff) {
        const { width, height } = img.getSize()
        ff = spawn(FFMPEG, [
          '-y',
          '-f',
          'rawvideo',
          '-pix_fmt',
          'bgra',
          '-s',
          `${width}x${height}`,
          '-r',
          `${FPS}`,
          '-i',
          '-',
          '-vf',
          'scale=1920:1080',
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          out
        ])
        ff.stderr!.on('data', (d) => (log = (log + d).slice(-2000)))
        ff.stdin!.on('error', () => {}) // exit code below reports the failure
      }
      if (!ff.stdin!.write(img.toBitmap())) await once(ff.stdin!, 'drain')
    }
    console.log(
      `rendered ${Math.round(duration * FPS)} frames at ${((duration * FPS * 1000) / (Date.now() - started)).toFixed(1)} fps`
    )
    ff!.stdin!.end()
    const [code] = await once(ff!, 'close')
    if (code !== 0) throw new Error(`ffmpeg exited ${code}: ${log}`)
    return out
  } finally {
    ff?.kill()
    win.destroy()
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.reelwright.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('render', render)

  // LR_RENDER=1 npm run dev → render the demo, print the path, quit (smoke test).
  if (process.env['LR_RENDER']) {
    render()
      .then(console.log, console.error)
      .finally(() => app.quit())
    return
  }

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
