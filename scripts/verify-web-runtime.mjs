import { spawn } from 'node:child_process'

const testProcess = spawn('pnpm', ['exec', 'vitest', 'run', 'src/renderer/desktop/desktop-smoke.test.ts'], {
  stdio: 'inherit'
})

testProcess.on('exit', (code) => {
  process.exit(code || 0)
})
