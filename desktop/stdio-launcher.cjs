const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js')
const { homedir } = require('node:os')

async function approvedStdio(config, confirm) {
  const { command, args, env = {} } = config
  if (typeof command !== 'string' || !command.trim() || command.includes('\0') ||
      !Array.isArray(args) || !args.every(a => typeof a === 'string' && !a.includes('\0')) ||
      !env || typeof env !== 'object' || Array.isArray(env) || !Object.entries(env).every(([k,v]) =>
        /^[A-Za-z_][A-Za-z_0-9]*$/.test(k) && typeof v === 'string' && !v.includes('\0'))) {
    throw Error('Invalid local MCP command')
  }
  const detail = JSON.stringify({ command, arguments: args, environmentKeys: Object.keys(env) }, null, 2)
  if (!(await confirm(detail))) throw Error('Local MCP launch declined')
  const path = [process.env.PATH, '/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin'].filter(Boolean).join(':')
  return new StdioClientTransport({ command, args, env: { PATH: path, ...env }, cwd: homedir(), stderr: 'ignore' })
}
module.exports = { approvedStdio }
