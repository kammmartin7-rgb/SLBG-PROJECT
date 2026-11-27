const { BrowserWindow, dialog, ipcMain, session } = require('electron')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { existsSync } = require('node:fs')
const { homedir } = require('node:os')
const { join } = require('node:path')
const { randomUUID } = require('node:crypto')
const runFile = promisify(execFile)

function adbPath() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(homedir(), 'Library/Android/sdk')
  return [join(sdk, 'platform-tools/adb'), '/opt/homebrew/bin/adb', '/usr/local/bin/adb']
    .find(existsSync) || 'adb'
}

exports.installDeviceTools = function(win) {
  const pages = new Map()
  async function confirm(detail) {
    const answer = await dialog.showMessageBox(win, { type: 'question', message: detail,
      buttons: ['Cancel', 'Allow once'], defaultId: 0, cancelId: 0 })
    if (answer.response !== 1) throw Error('Action declined')
  }
  function browserFor(id) {
    if (pages.has(id)) return pages.get(id)
    if (pages.size >= 4) throw Error('Close an open agent browser window first.')
    const isolated = session.fromPartition('agent-' + randomUUID())
    isolated.setPermissionRequestHandler((_wc, _permission, cb) => cb(false))
    isolated.setPermissionCheckHandler(() => false)
    isolated.on('will-download', event => event.preventDefault())
    isolated.webRequest.onBeforeRequest((details, done) => done({ cancel: !/^(https:|data:|blob:|about:)/.test(details.url) }))
    const page = new BrowserWindow({ title: 'Agent browser', webPreferences: { session: isolated,
      sandbox: true, contextIsolation: true, nodeIntegration: false } })
    page.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    page.on('closed', () => pages.delete(id))
    pages.set(id, page)
    return page
  }
  ipcMain.handle('desktop:device-tool', async (event, id, action, args = {}) => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame ||
        !event.senderFrame.url.startsWith('yachiyo://app/')) throw Error('Invalid caller')
    if (typeof id !== 'string' || !id.length || id.length > 180) throw Error('Missing conversation')
    if (action === 'run_workspace_code') {
      return require('./code-workspace.cjs').runCode(require('electron').app.getPath('userData'), id, args, confirm)
    }
    if (action === 'metis_latest_block') return require('./metis.cjs').metisBlock()
    if (action.startsWith('browser_')) {
      if (action === 'browser_navigate') {
        const url = new URL(args.url)
        if (url.protocol !== 'https:' || url.username || url.password) throw Error('Expected an HTTPS page')
        const page = browserFor(id)
        await page.loadURL(url.href)
      }
      const page = pages.get(id)
      if (!page) throw Error('Navigate to a page first.')
      const wc = page.webContents
      if (action === 'browser_click') {
        if (!Number.isInteger(args.index) || args.index < 0 || args.index >= 80) throw Error('Invalid element')
        const item = page.agentElements?.[args.index]
        if (!item || args.snapshot !== page.agentSnapshot || wc.getURL() !== page.agentUrl) throw Error('Refresh the snapshot.')
        await confirm('Click “' + item.label + '” on ' + wc.getURL() + '?')
        const activated = await wc.executeJavaScriptInIsolatedWorld(1, [{ code: `(() => {
          const el = globalThis.agentElements?.[${args.index}]
          if (!el || !el.isConnected || el.disabled) return false
          el.click(); return true
        })()` }])
        if (!activated) throw Error('Element has changed. Refresh the snapshot.')
      } else if (!['browser_navigate','browser_snapshot'].includes(action)) throw Error('Unknown browser action')
      const view = await wc.executeJavaScriptInIsolatedWorld(1, [{ code: `(() => {
        const elements = Array.from(document.querySelectorAll('a[href],button,input[type=button],[role=button]'))
          .filter(el => el.getClientRects().length).slice(0,80)
        globalThis.agentElements = elements
        return {title:document.title,text:(document.body?.innerText || '').slice(0,8000),
          elements:elements.map((el,index)=>({index,label:(el.innerText || el.getAttribute('aria-label') || el.tagName).slice(0,100)}))}
      })()` }])
      page.agentElements = view.elements
      page.agentSnapshot = randomUUID()
      page.agentUrl = wc.getURL()
      return { ...view, url: page.agentUrl, snapshot: page.agentSnapshot }
    }
    const run = async (args, binary = false) => (await runFile(adbPath(), args,
      { timeout: 12000, maxBuffer: 8 * 1024 * 1024, encoding: binary ? 'buffer' : 'utf8' })).stdout
    if (action === 'adb_devices') return { devices: await run(['devices','-l']) }
    if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(args.serial || '')) throw Error('Select a serial from adb_devices.')
    const target = ['-s',args.serial]
    if (action === 'adb_device_info') return { model: (await run([...target,'shell','getprop','ro.product.model'])).trim() }
    if (action === 'adb_ui_tree') {
      await confirm('Read the current screen on ' + args.serial + '?')
      return { screen: (await run([...target,'exec-out','uiautomator','dump','/dev/tty'])).slice(0,64000) }
    }
    if (action === 'adb_tap') {
      if (![args.x,args.y].every(n => Number.isInteger(n) && n >= 0 && n <= 16384)) throw Error('Invalid screen coordinates')
      await confirm('Tap (' + args.x + ', ' + args.y + ') on ' + args.serial + '?')
      await run([...target,'shell','input','tap',String(args.x),String(args.y)])
      return { tapped: true }
    }
    throw Error('Unknown device action')
  })
  win.on('closed', () => {
    ipcMain.removeHandler('desktop:device-tool')
    for (const page of pages.values()) page.destroy()
  })
}
