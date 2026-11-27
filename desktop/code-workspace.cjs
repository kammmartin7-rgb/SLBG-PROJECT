const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { createHash, randomUUID } = require('node:crypto')
const { existsSync, mkdirSync } = require('node:fs')
const { join } = require('node:path')
const run = promisify(execFile)

async function runCode(root, sessionId, input, confirm) {
  const { language, source, args } = input
  const git = language === 'git'
  if (git ? !Array.isArray(args) || !args.length || args.length > 40 ||
    !args.every(a => typeof a === 'string' && a.length <= 1024) :
    !['python','typescript'].includes(language) || typeof source !== 'string' || !source.length || source.length > 16000) {
    throw Error('Invalid workspace command')
  }
  const executable = ['/usr/local/bin/docker','/opt/homebrew/bin/docker','/Applications/Docker.app/Contents/Resources/bin/docker'].find(existsSync)
  if (!executable) throw Error('Docker Desktop is required for isolated code execution.')
  const image = language === 'typescript' ? 'node:24-bookworm' : 'python:3.12-bookworm'
  await confirm('Run in an isolated workspace using ' + image + ' (download image if needed)?\n' +
    (git ? JSON.stringify(args) : source))
  const folder = join(root, 'code-workspaces', createHash('sha256').update(sessionId).digest('hex'))
  mkdirSync(folder, { recursive: true, mode: 0o700 })
  const name = 'yachiyo-' + randomUUID()
  const command = git ? ['git', ...args] : language === 'python' ? ['python', '-I', '-c', source] :
    ['node', '--input-type=module-typescript', '--eval', source]
  try {
    const result = await run(executable, ['run','--rm','--name',name,'--network=none','--read-only',
      '--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=64','--cpus=1','--memory=256m',
      '--user', String(process.getuid()) + ':' + process.getgid(), '--tmpfs','/tmp:rw,nosuid,nodev,size=32m',
      '--env','HOME=/tmp','--volume',folder + ':/workspace:rw','--workdir','/workspace',image,...command],
      { timeout: 120000, maxBuffer: 256 * 1024 })
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr }
  } catch (error) {
    if (error.killed || error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
      await run(executable, ['rm','-f',name], { timeout: 10000 }).catch(() => {})
      throw Error('Workspace task exceeded the time or output limit.')
    }
    return { exitCode: error.code, stdout: error.stdout, stderr: error.stderr || error.message }
  }
}
module.exports = { runCode }
