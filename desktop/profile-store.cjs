const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')

// Synchronous atomic replacement keeps consecutive IPC writes in arrival order.
function profileStore(directory, encryption, filename) {
  const file = path.join(directory, filename)
  return {
    exists() { return fs.existsSync(file) },
    read() {
      let bytes
      try { bytes = fs.readFileSync(file) } catch (error) {
        if (error.code === 'ENOENT') return null
        throw error
      }
      return JSON.parse(encryption.decryptString(bytes))
    },
    write(value) {
      if (!encryption.isEncryptionAvailable()) throw Error('macOS Keychain is unavailable.')
      const bytes = encryption.encryptString(JSON.stringify(value))
      const temp = file + '.' + randomUUID()
      try {
        fs.writeFileSync(temp, bytes, { mode: 0o600, flag: 'wx' })
        fs.renameSync(temp, file)
      } finally { fs.rmSync(temp, { force: true }) }
    },
    clear() { fs.rmSync(file, { force: true }) },
  }
}
module.exports = { profileStore }
