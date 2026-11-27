const { ipcMain, net, shell, dialog } = require('electron')
const { randomUUID } = require('node:crypto')
const { join } = require('node:path')
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js')
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js')

exports.installConnections = function installConnections(win) {
  const { credentialKey, login, httpsUrl } = require('./oauth.cjs')
  const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js')
  const credentials = new Map()
  const connections = new Map()
  function assertSender(event) {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame ||
        !event.senderFrame.url.startsWith('yachiyo://app/')) throw Error('Invalid desktop caller')
  }
  const { app } = require('electron')
  const { mathPython, setupMath } = require('./math-setup.cjs')
  let installing
  ipcMain.handle('desktop-mcp:math-setup', async event => {
    assertSender(event)
    if (!installing) installing = setupMath(app.getPath('userData')).finally(() => { installing = undefined })
    await installing
  })
  let workflows
  let pairing
  let startingPair = false
  let closed = false
  ipcMain.handle('desktop-mcp:pair', async (event, profile) => {
    assertSender(event)
    if (!profile) { pairing?.close(); pairing = undefined; return }
    if (startingPair) throw Error('Pairing already in progress')
    startingPair = true
    try {
      const { startPair, askLocalModel, checkPair } = require('./paired-agent.cjs')
      workflows ??= require('./workflows.cjs').desktopWorkflows(app.getPath('userData'), askLocalModel)
      const next = await startPair(profile, askLocalModel, workflows)
      try { await checkPair(next, profile) } catch (error) { next.close(); throw error }
      if (closed) { next.close(); throw Error('Desktop window closed') }
      pairing?.close()
      pairing = next
      return { secret: pairing.secret, port: pairing.port }
    } finally { startingPair = false }
  })
  ipcMain.handle('desktop-mcp:login', async (event, config) => {
    assertSender(event)
    const key = credentialKey(config)
    const openBrowser = async url => {
      const choice = await dialog.showMessageBox(win, { message: 'Sign in to ' + httpsUrl(config.url).host,
        detail: 'Open ' + httpsUrl(url).origin + ' in your browser?', buttons: ['Cancel', 'Continue'], defaultId: 0, cancelId: 0 })
      if (choice.response !== 1) throw Error('Sign-in cancelled')
      await shell.openExternal(url)
    }
    credentials.set(key, await login(config, openBrowser, net.fetch.bind(net)))
  })
  ipcMain.handle('desktop-mcp:open', async (event, kind) => {
    assertSender(event)
    if (connections.size >= 16) throw Error('Desktop connection limit reached')
    let transport
    if (kind === 'math') {
      transport = new StdioClientTransport({ command: process.execPath, args: [join(__dirname.replace(/app\.asar$/, 'app.asar.unpacked'), 'math.cjs')],
        env: { ELECTRON_RUN_AS_NODE: '1', PATH: [process.env.PATH, '/usr/local/bin', '/opt/homebrew/bin', '/usr/bin'].filter(Boolean).join(':'), YACHIYO_MATH_PYTHON: mathPython(app.getPath('userData')) }, stderr: 'ignore' })
    } else if (kind?.type === 'stdio') {
      transport = await require('./stdio-launcher.cjs').approvedStdio(kind, async detail => {
        const choice = await dialog.showMessageBox(win, { type: 'warning', message: 'Run this program on your Mac?',
          detail, buttons: ['Cancel', 'Run once'], cancelId: 0, defaultId: 0 })
        return choice.response === 1
      })
    } else if (kind === 'learn') {
      transport = new StreamableHTTPClientTransport(new URL('https://learn.microsoft.com/api/mcp'), {
        fetch: (input, options) => net.fetch(input, { ...options, credentials: 'omit', redirect: 'error' })
      })
    } else if (kind?.type === 'http' && kind.oauth?.enabled) {
      const credential = credentials.get(credentialKey(kind))
      if (!credential || (credential.expires && credential.expires <= Date.now())) throw Error('Sign in with OAuth to start this connection.')
      const resource = httpsUrl(kind.url)
      const Transport = kind.protocol === 'sse' ? SSEClientTransport : StreamableHTTPClientTransport
      transport = new Transport(resource, { fetch: (input, options) => {
        const target = httpsUrl(input instanceof Request ? input.url : input)
        if (target.origin !== resource.origin) throw Error('Refusing cross-origin MCP request')
        const headers = new Headers(options?.headers)
        headers.set('Authorization', 'Bearer ' + credential.value)
        return net.fetch(target.href, { ...options, headers, redirect: 'error', credentials: 'omit' })
      } })
    } else throw Error('Unknown desktop service')
    const id = randomUUID()
    connections.set(id, transport)
    const notify = (type, value) => {
      if (!win.isDestroyed()) win.webContents.send('desktop-mcp:event', id, type, value)
    }
    transport.onmessage = message => notify('message', message)
    transport.onerror = () => notify('error', 'Desktop MCP transport failed')
    transport.onclose = () => { connections.delete(id); notify('close') }
    try { await transport.start(); return id } catch (error) {
      connections.delete(id)
      await transport.close().catch(() => {})
      throw Error('Could not start the selected MCP service')
    }
  })
  ipcMain.handle('desktop-mcp:send', async (event, id, message) => {
    assertSender(event)
    const transport = connections.get(id)
    if (!transport || !message || JSON.stringify(message).length > 131072) throw Error('Invalid MCP request')
    await transport.send(message)
  })
  ipcMain.handle('desktop-mcp:close', async (event, id) => {
    assertSender(event)
    await connections.get(id)?.close()
    connections.delete(id)
  })
  function cleanup() {
    for (const transport of connections.values()) void transport.close().catch(() => {})
    connections.clear()
  }
  win.webContents.on('render-process-gone', cleanup)
  win.on('closed', () => {
    closed = true
    workflows?.close()
    pairing?.close()
    cleanup()
    for (const name of ['open', 'send', 'close', 'login', 'pair', 'math-setup']) ipcMain.removeHandler('desktop-mcp:' + name)
  })
}
