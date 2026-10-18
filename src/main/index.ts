import { app, shell, BrowserWindow, dialog, ipcMain, protocol } from 'electron'
import { z } from 'zod'
import { join } from 'path'
import { readFile } from 'fs/promises'
import { spawn } from 'child_process'
import { once } from 'events'
import { FORMATS, GenerateRequest, Storyboard, duration } from '../shared/schema'
import { generate } from './generate'
import { FFMPEG, soundtrack } from './audio'
import { attach, serveAsset } from './attachments'
import { demo } from '../shared/demo'
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

  // a file dropped on the window must never replace the app
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault())

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

const FPS = 30

// Seek the Player frame by frame in an offscreen window and pipe raw frames into ffmpeg.
async function render(input: unknown): Promise<string> {
  const sb = Storyboard.parse(input)
  const audio = await soundtrack(sb)
  const [W, H] = FORMATS[sb.format]
  const win = new BrowserWindow({
    width: W,
    height: H,
    show: false,
    webPreferences: { offscreen: true, backgroundThrottling: false }
  })
  const out = join(app.getPath('videos'), `reelwright-${Date.now()}.mp4`)
  let ff: ReturnType<typeof spawn> | undefined
  let log = ''
  try {
    await load(win, 'render')
    const wc = win.webContents
    await wc.executeJavaScript(
      'new Promise(r => { const c = () => window.__load ? r() : setTimeout(c, 10); c() })'
    )
    await wc.executeJavaScript(`__load(${JSON.stringify(sb)})`)
    const frames = Math.round(duration(sb) * FPS)
    const started = Date.now()
    for (let i = 0; i < frames; i++) {
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
          ...(audio ? ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'copy'] : []),
          '-vf',
          `scale=${W}:${H}`,
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
          out
        ])
        ff.stderr!.on('data', (d) => (log = (log + d).slice(-2000)))
        ff.stdin!.on('error', () => {}) // exit code below reports the failure
      }
      if (!ff.stdin!.write(img.toBitmap())) await once(ff.stdin!, 'drain')
    }
    console.log(
      `rendered ${frames} frames at ${((frames * 1000) / (Date.now() - started)).toFixed(1)} fps`
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

// Attachments are served read-only from the asset store; stream lets <video> seek with range requests.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app-asset',
    privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true }
  }
])

const AttachInput = z.object({
  name: z.string().min(1).max(255),
  path: z.string().optional(),
  data: z.instanceof(Uint8Array).optional()
})

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

  ipcMain.handle('render', (_, sb) => render(sb))
  protocol.handle('app-asset', serveAsset)
  ipcMain.handle('attach', (_, input) => attach(AttachInput.parse(input)))
  ipcMain.handle('pickFiles', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    const r = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Images, video, documents',
          extensions: [
            'png',
            'jpg',
            'jpeg',
            'webp',
            'gif',
            'svg',
            'mp4',
            'mov',
            'webm',
            'm4v',
            'pdf',
            'docx',
            'txt',
            'md',
            'csv',
            'json'
          ]
        }
      ]
    })
    return Promise.allSettled(
      r.filePaths.map((path) => attach({ name: path.split('/').pop()!, path }))
    )
  })
  ipcMain.handle('generate', (_, req) => generate(GenerateRequest.parse(req)))
  ipcMain.handle('soundtrack', async (_, sb) => {
    const path = await soundtrack(Storyboard.parse(sb))
    return path && readFile(path)
  })

  // Smoke test: LR_RENDER=landscape|vertical|square pnpm dev renders the demo, prints the path, quits.
  // LR_PROMPT="..." generates with Ollama first; LR_KIND, LR_TONE, LR_DURATION, LR_VOICE (e.g. af_heart),
  // LR_MUSIC=0 and LR_ATTACH=/path/a.png,/path/b.mov set kind, tone, length, narration, music, attachments.
  const format = process.env['LR_RENDER']
  if (format) {
    const env = process.env
    const smoke = async (): Promise<Storyboard> => {
      if (!env['LR_PROMPT']) return demo
      const files = (env['LR_ATTACH'] ?? '').split(',').filter(Boolean)
      const atts = await Promise.all(
        files.map((path) => attach({ name: path.split('/').pop()!, path }))
      )
      return generate(
        GenerateRequest.parse({
          text: env['LR_PROMPT'],
          kind: env['LR_KIND'] ?? 'launch',
          format,
          tone: env['LR_TONE'] ?? 'default',
          duration: +(env['LR_DURATION'] ?? 20),
          voice: env['LR_VOICE'],
          music: env['LR_MUSIC'] !== '0',
          attachments: atts.map((a) => a.id)
        })
      )
    }
    smoke()
      .then(
        (sb) => (
          console.log(JSON.stringify(sb, null, 1)),
          render({ ...sb, format, tone: env['LR_TONE'] ?? sb.tone })
        )
      )
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
