const { ipcMain, net } = require('electron')
const { randomUUID } = require('node:crypto')
const { join } = require('node:path')
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js')
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js')

exports.installConnections = function installConnections(win) {
  const connections = new Map()
  function assertSender(event) {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame ||
        !event.senderFrame.url.startsWith('yachiyo://app/')) throw Error('Invalid desktop caller')
  }
  ipcMain.handle('desktop-mcp:open', async (event, kind) => {
    assertSender(event)
    if (connections.size >= 16) throw Error('Desktop connection limit reached')
    let transport
    if (kind === 'math') {
      transport = new StdioClientTransport({ command: process.execPath, args: [join(__dirname.replace(/app\.asar$/, 'app.asar.unpacked'), 'math.cjs')],
        env: { ELECTRON_RUN_AS_NODE: '1' }, stderr: 'ignore' })
    } else if (kind === 'learn') {
      transport = new StreamableHTTPClientTransport(new URL('https://learn.microsoft.com/api/mcp'), {
        fetch: (input, options) => net.fetch(input, { ...options, credentials: 'omit', redirect: 'error' })
      })
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
    cleanup()
    for (const name of ['open', 'send', 'close']) ipcMain.removeHandler('desktop-mcp:' + name)
  })
}
