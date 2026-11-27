const { app, autoUpdater, BrowserWindow, dialog, net, protocol, session, shell } = require('electron')
const { join, resolve, extname, sep } = require('node:path')
const { pathToFileURL } = require('node:url')

// Keep existing conversations and settings when the display name changes.
if (!app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', join(app.getPath('appData'), 'Yachiyo Claw'))
}

const scheme = 'yachiyo'
const origin = 'yachiyo://app'
protocol.registerSchemesAsPrivileged([{
  scheme,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
}])

const releasePage = 'https://github.com/kammmartin7-rgb/Yachiyo-claw-stronger/releases/latest'

async function checkDesktopUpdate() {
  if (!app.isPackaged || process.platform !== 'darwin') return
  const feed = 'https://update.electronjs.org/kammmartin7-rgb/Yachiyo-claw-stronger/darwin-' +
    process.arch + '/' + encodeURIComponent(app.getVersion())
  try {
    // Developer ID builds can install verified updates when the user quits normally.
    const { promisify } = require('node:util')
    const inspect = promisify(require('node:child_process').execFile)
    const { stderr } = await inspect('/usr/bin/codesign', ['-dv', '--verbose=4', process.execPath])
    if (/^Authority=Developer ID Application:/m.test(stderr)) {
      autoUpdater.on('error', error => console.warn('Desktop update failed:', error.message))
      autoUpdater.setFeedURL({ url: feed })
      autoUpdater.checkForUpdates()
      return
    }
    // Locally signed builds can notify the user about a compatible Mac release.
    const response = await net.fetch(feed, { credentials: 'omit', signal: AbortSignal.timeout(15000) })
    if (response.status !== 200) return
    const update = await response.json()
    if (typeof update.url !== 'string') return
    const choice = await dialog.showMessageBox({
      type: 'info', message: 'A Hacker Tool update is available.',
      buttons: ['Open download page', 'Later'], cancelId: 1, defaultId: 1
    })
    if (choice.response === 0) await shell.openExternal(releasePage)
  } catch (error) {
    console.warn('Desktop update check unavailable:', error.message)
  }
}

function openWindow() {
  const win = new BrowserWindow({
    title: 'Hacker Tool',
    width: 1150, height: 800, minWidth: 520, minHeight: 500,
    webPreferences: { preload: join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false }
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(origin + '/')) event.preventDefault()
  })
  require('./device-tools.cjs').installDeviceTools(win)
  require('./connections.cjs').installConnections(win)
  win.loadURL(origin + '/')
}

app.whenReady().then(() => {
  const root = resolve(app.getAppPath(), 'renderer')
  protocol.handle(scheme, async (request) => {
    const url = new URL(request.url)
    if (url.host === 'app' && url.pathname.startsWith('/local-ollama/')) {
      const path = url.pathname.slice('/local-ollama'.length)
      const chat = path === '/v1/chat/completions' && request.method === 'POST'
      const models = path === '/v1/models' && request.method === 'GET'
      if ((!chat && !models) || url.search || (request.headers.has('origin') && request.headers.get('origin') !== origin)) {
        return new Response(null, { status: 403 })
      }
      try {
        let body
        if (chat) {
          if (!request.headers.get('content-type')?.startsWith('application/json')) return new Response(null, { status: 415 })
          const payload = await request.json()
          const { fastChat, hasToolTurn, compatiblePayload } = require('./fast-chat.cjs')
          const toolTurn = hasToolTurn(payload)
          const fast = !toolTurn && await fastChat(payload, request.signal)
          if (fast) return fast
          body = JSON.stringify(compatiblePayload(payload, toolTurn))
        }
        const upstream = await fetch('http://127.0.0.1:11434' + path, {
          method: request.method, headers: { 'Content-Type': 'application/json' },
          body, signal: request.signal, redirect: 'error'
        })
        return new Response(upstream.body, { status: upstream.status, headers: {
          'Content-Type': upstream.headers.get('content-type') || 'application/json'
        } })
      } catch {
        return new Response('Local Ollama service unavailable', { status: 502 })
      }
    }
    if (url.host !== 'app' || request.method !== 'GET') return new Response(null, { status: 403 })
    let pathname
    try { pathname = decodeURIComponent(url.pathname) } catch { return new Response(null, { status: 400 }) }
    const asset = resolve(root, '.' + pathname)
    if (asset !== root && !asset.startsWith(root + sep)) return new Response(null, { status: 403 })
    const file = !extname(pathname) && request.headers.get('accept')?.includes('text/html')
      ? join(root, 'index.html') : asset
    try { return await net.fetch(pathToFileURL(file).href) } catch { return new Response(null, { status: 404 }) }
  })
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  openWindow()
  void checkDesktopUpdate()
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) openWindow() })
})

app.on('window-all-closed', () => app.quit())
