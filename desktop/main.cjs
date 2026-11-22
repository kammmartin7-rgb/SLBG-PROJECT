const { app, BrowserWindow, net, protocol, session } = require('electron')
const { join, resolve, extname, sep } = require('node:path')
const { pathToFileURL } = require('node:url')

const scheme = 'yachiyo'
const origin = 'yachiyo://app'
protocol.registerSchemesAsPrivileged([{
  scheme,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
}])

function openWindow() {
  const win = new BrowserWindow({
    title: 'Yachiyo Claw',
    width: 1150, height: 800, minWidth: 520, minHeight: 500,
    webPreferences: { preload: join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false }
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(origin + '/')) event.preventDefault()
  })
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
          // The agent may attach default tools to a plain conversation.
          // This local endpoint supports chat and never dispatches actions.
          for (const key of ['tools', 'tool_choice', 'parallel_tool_calls', 'functions', 'function_call']) {
            delete payload[key]
          }
          const fast = await require('./fast-chat.cjs').fastChat(payload, request.signal)
          if (fast) return fast
          body = JSON.stringify(payload)
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
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) openWindow() })
})

app.on('window-all-closed', () => app.quit())
