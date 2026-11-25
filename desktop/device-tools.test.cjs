const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { runInNewContext } = require('node:vm')
const { EventEmitter } = require('node:events')

function fixture() {
  const calls = [], handlers = new Map()
  let consent = 0
  const webContents = { mainFrame: { url: 'yachiyo://app/' } }
  const owner = Object.assign(new EventEmitter(), { webContents })
  class Page extends EventEmitter {
    constructor() {
      super()
      this.webContents = {
        setWindowOpenHandler() {}, getURL: () => this.url,
        executeJavaScriptInIsolatedWorld: async (_world, scripts) => scripts[0].code.includes('document.title')
          ? { title: 'Example', text: 'Hello', elements: [{index:0,label:'Open'}] } : true,
      }
    }
    async loadURL(url) { this.url = url }
  }
  const electron = {
    BrowserWindow: Page,
    dialog: { showMessageBox: async () => ({response:consent}) },
    ipcMain: { handle: (key, callback) => handlers.set(key,callback) },
    session: { fromPartition: () => ({
      setPermissionRequestHandler() {}, setPermissionCheckHandler() {}, on() {}, webRequest:{ onBeforeRequest() {} },
    }) },
  }
  const exports = {}
  runInNewContext(readFileSync(require.resolve('./device-tools.cjs'),'utf8'), {
    exports, URL, process, require(name) {
      if (name === 'electron') return electron
      if (name === 'node:child_process') return {execFile: (path,args,opts,done) => {
        calls.push(Array.from(args)); done(null,{stdout:'Pixel_8a'})
      }}
      return require(name)
    },
  })
  exports.installDeviceTools(owner)
  const invoke = handlers.get('desktop:device-tool')
  const event = { sender:webContents, senderFrame:webContents.mainFrame }
  return { run: (action,args,id='chat') => invoke(event,id,action,args), calls, allow: () => {consent=1}, invoke }
}
test('device enumeration, serial targeting and denied tap', async () => {
  const f=fixture()
  await f.run('adb_devices',{})
  await f.run('adb_device_info',{serial:'test'})
  assert.deepEqual(f.calls,[['devices','-l'],['-s','test','shell','getprop','ro.product.model']])
  await assert.rejects(f.run('adb_tap',{serial:'test',x:4,y:5}),/declined/)
  f.allow()
  await f.run('adb_tap',{serial:'test',x:4,y:5})
  assert.deepEqual(f.calls.at(-1),['-s','test','shell','input','tap','4','5'])
  await assert.rejects(f.invoke({},'chat','adb_devices',{}),/Invalid caller/)
})
test('browser snapshots belong to their conversation and stale clicks are rejected', async () => {
  const f=fixture()
  await assert.rejects(f.run('browser_navigate',{url:'file:///tmp/read'}),/HTTPS/)
  const snap=await f.run('browser_navigate',{url:'https://example.org'})
  assert.equal(snap.title,'Example')
  await assert.rejects(f.run('browser_snapshot',{},'other'),/Navigate/)
  await f.run('browser_snapshot',{})
  await assert.rejects(f.run('browser_click',{snapshot:snap.snapshot,index:0}),/Refresh/)
})
