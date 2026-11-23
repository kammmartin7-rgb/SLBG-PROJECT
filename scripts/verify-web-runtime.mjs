import { spawn } from 'node:child_process'
import { webkit } from 'playwright'

const port = 8089
const secret = 'verify-runtime-secret'
const srv = spawn(
  'pnpm',
  ['exec', 'tsx', '-e', `import { createDesktopMcpServer } from './src/renderer/desktop/mcp-server'; createDesktopMcpServer(${port}, '${secret}', { allowLan: false }).start()`],
  { stdio: 'ignore' }
)

const waitReady = async () => {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/`)
      if (r.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('Server did not start on ' + port)
}

try {
  await waitReady()
  const browser = await webkit.launch()
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (err) => errors.push(err.stack || err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  const bodyText = await page.textContent('body')
  if (bodyText?.includes('Something went wrong!')) {
    const showBtn = await page.$('text=Show Error')
    if (showBtn) await showBtn.click()
    const fullError = await page.textContent('body')
    throw new Error('Runtime React ErrorBoundary triggered:\n' + fullError)
  }
  if (errors.length > 0) {
    throw new Error('Uncaught browser runtime errors:\n' + errors.join('\n'))
  }

  await browser.close()
  console.log('LAYER 2 RUNTIME CHECK PASSED: 0 pageerrors, 0 ErrorBoundary crashes.')
} finally {
  srv.kill('SIGKILL')
}
