const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { profileStore } = require('./profile-store.cjs')

test('connections survive reopening the profile and a failed replacement', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-store-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const mockEncryption = {
    isEncryptionAvailable: () => true,
    encryptString: text => Buffer.from(text),
    decryptString: bytes => bytes.toString(),
  }
  const reopen = () => profileStore(directory, mockEncryption, 'settings.enc')
  assert.equal(reopen().read(), null)
  const saved = { providers: { ollama: { models: ['qwen-local', 'deepseek-r1'] }, nvidia: {} }, mcp: { servers: [{ id: 'vm-status' }] } }
  reopen().write(saved)
  assert.deepEqual(reopen().read(), saved)
  mockEncryption.isEncryptionAvailable = () => false
  assert.throws(() => reopen().write({}), /Keychain/)
  assert.deepEqual(reopen().read(), saved)
  reopen().clear()
  assert.equal(reopen().read(), null)
})
