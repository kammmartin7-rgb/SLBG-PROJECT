const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('yachiyoDesktop', {
  setupMath: () => ipcRenderer.invoke('desktop-mcp:math-setup'),
  pair: profile => ipcRenderer.invoke('desktop-mcp:pair', profile),
  login: config => ipcRenderer.invoke('desktop-mcp:login', config),
  deviceTool: (id, action, args) => ipcRenderer.invoke('desktop:device-tool', id, action, args),
  open: kind => ipcRenderer.invoke('desktop-mcp:open', kind),
  send: (id, message) => ipcRenderer.invoke('desktop-mcp:send', id, message),
  close: id => ipcRenderer.invoke('desktop-mcp:close', id),
  subscribe: callback => {
    const listener = (_event, id, type, value) => callback(id, type, value)
    ipcRenderer.on('desktop-mcp:event', listener)
    return () => ipcRenderer.removeListener('desktop-mcp:event', listener)
  }
})
