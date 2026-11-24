import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { extname, join, normalize, resolve } from 'node:path'
import { URL } from 'node:url'
import { exec, execSync } from 'node:child_process'
import crypto from 'node:crypto'
import { McpHttpService } from '../mobile/mcp-http-service'
import { getAgentSessionConfig } from '../mobile/agent-session-config'

export interface DesktopMcpServer {
  start(): Promise<void>
  stop(): Promise<void>
}

interface SyncEnvelope {
  revision: number
  updatedAt: string
  deviceId?: string
  data: Record<string, unknown>
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
}

function setCorsHeaders(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, X-Target-Url')
}

async function readBody(req: IncomingMessage): Promise<string> {
  let body = ''
  for await (const chunk of req) {
    body += chunk
  }
  return body
}


export interface DesktopMcpServerOptions {
  allowLan?: boolean
  allowedHosts?: string[]
  staticDir?: string
  syncDir?: string
}

export function generateRandomSecret() {
  return crypto.randomBytes(32).toString('hex')
}

export function createDesktopMcpServer(
  port = 8080,
  secret: string,
  options?: { allowLan?: boolean; allowedHosts?: string[]; staticDir?: string; syncDir?: string }
): DesktopMcpServer {
  const syncDir = options?.syncDir || join(homedir(), '.yachiyo-claw')
  const syncFile = join(syncDir, 'sync-state.json')
  const staticDir = resolve(options?.staticDir || join(process.cwd(), 'dist', 'renderer'))
  if (!existsSync(syncDir)) mkdirSync(syncDir, { recursive: true })

  const readSyncState = (): SyncEnvelope => {
    try {
      if (existsSync(syncFile)) return JSON.parse(readFileSync(syncFile, 'utf8')) as SyncEnvelope
    } catch {}
    return { revision: 0, updatedAt: new Date(0).toISOString(), data: {} }
  }

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      setCorsHeaders(res)
      if (req.method === 'OPTIONS') {
        res.writeHead(204).end()
        return
      }
      const reqUrl = new URL(req.url || '/', `http://localhost:${port}`)
      const pathname = reqUrl.pathname
      const isAuthorized = () => req.headers.authorization?.replace(/^Bearer\s+/i, '').trim() === secret

      if (pathname === '/sync') {
        if (!isAuthorized()) {
          res.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Unauthorized' }))
          return
        }
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(readSyncState()))
          return
        }
        if (req.method === 'POST') {
          const payload = JSON.parse((await readBody(req)) || '{}') as Partial<SyncEnvelope>
          const current = readSyncState()
          const incomingRev = typeof payload.revision === 'number' ? payload.revision : Date.now()
          if (incomingRev >= current.revision && payload.data && typeof payload.data === 'object') {
            const next: SyncEnvelope = {
              revision: incomingRev,
              updatedAt: new Date().toISOString(),
              deviceId: payload.deviceId,
              data: payload.data,
            }
            writeFileSync(syncFile, JSON.stringify(next, null, 2), 'utf8')
            res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(next))
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(current))
          }
          return
        }
        res.writeHead(405).end()
        return
      }

      if (pathname === '/proxy') {
        const targetRaw = reqUrl.searchParams.get('url') || req.headers['x-target-url']?.toString()
        if (!targetRaw) {
          res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Missing url' }))
          return
        }
        const forwardHeaders: Record<string, string> = {}
        for (const [k, v] of Object.entries(req.headers)) {
          if (!v) continue
          if (['host', 'origin', 'referer', 'connection', 'content-length', 'x-target-url'].includes(k.toLowerCase())) continue
          forwardHeaders[k] = Array.isArray(v) ? v.join(', ') : v
        }
        const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)
        const upstream = await fetch(new URL(targetRaw).toString(), { method: req.method, headers: forwardHeaders, body })
        const respHeaders: Record<string, string> = { 'Access-Control-Allow-Origin': '*' }
        upstream.headers.forEach((val, key) => {
          if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(key.toLowerCase())) respHeaders[key] = val
        })
        res.writeHead(upstream.status, respHeaders).end(Buffer.from(await upstream.arrayBuffer()))
        return
      }

      if (pathname === '/mcp') {
        if (!isAuthorized()) {
          res.writeHead(401).end()
          return
        }
        const service = new McpHttpService({
          endpoint: `http://localhost:${port}/mcp`,
          policy: { allowLan: options?.allowLan, allowedHosts: options?.allowedHosts },
          fetchImpl: async (input, init) => fetch(new URL(input.toString(), `http://localhost:${port}`), init),
        })
        if (req.method === 'POST') {
          const result = await service.call(JSON.parse(await readBody(req)))
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result))
        } else if (req.method === 'DELETE') {
          await service.close()
          res.writeHead(204).end()
        } else {
          res.writeHead(405).end()
        }
        return
      }

      if (pathname === '/tools/list') {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({
          tools: (() => {
            const config = getAgentSessionConfig(req.headers['mcp-session-id']?.toString())
            const tools = []
            
            if (config.deviceControlEnabled || config.desktopControlEnabled) {
              tools.push(
                'adb_devices',
                'adb_screenshot',
                'adb_ui_tree',
                'adb_tap',
                'adb_input_text',
                'adb_keyevent',
                'adb_logcat',
                'adb_shell',
                'adb_install_apk',
                'fastboot_devices',
                'fastboot_getvar'
              )
            }
            
            if (config.desktopControlEnabled) {
              tools.push(
                'desktop_shell',
                'desktop_file_read',
                'desktop_file_write',
                'desktop_process_list'
              )
            }
            
            return tools
          })()
        }))
        return
      }

      if (pathname === '/desktop-mcp-autoconfig') {
        const remoteAddress = req.socket.remoteAddress
        if (remoteAddress !== '127.0.0.1' && remoteAddress !== '::1' && remoteAddress !== '::ffff:127.0.0.1') {
          res.writeHead(403).end()
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({
          url: `http://localhost:${port}/mcp`,
          token: secret
        }))
        return
      }

      if (pathname === '/tools/call') {
        if (!isAuthorized()) {
          res.writeHead(401).end()
          return
        }
        try {
          const { tool, args } = JSON.parse(await readBody(req))
          let result: any
          switch (tool) {
            case 'adb_devices':
              result = execSync('adb devices -l', { encoding: 'utf8' })
              break
            case 'adb_screenshot':
              result = execSync('adb exec-out screencap -p', { encoding: 'base64' })
              break
            case 'adb_ui_tree':
              result = execSync('adb exec-out uiautomator dump /dev/tty', { encoding: 'utf8' })
              break
            case 'adb_tap':
              if (!args || args.length < 2) throw new Error('Missing x,y coordinates')
              execSync(`adb shell input tap ${args[0]} ${args[1]}`)
              result = { success: true }
              break
            case 'adb_input_text':
              if (!args || !args[0]) throw new Error('Missing text')
              execSync(`adb shell input text "${args[0].replace(/"/g, '\\"')}"`)
              result = { success: true }
              break
            case 'adb_logcat':
              result = execSync('adb logcat -d -t 100', { encoding: 'utf8' })
              break
            case 'adb_install_apk':
              if (!args || !args[0]) throw new Error('Missing APK path')
              result = execSync(`adb install -r "${args[0]}"`, { encoding: 'utf8' })
              break
            case 'adb_keyevent':
              if (!args || !args[0]) throw new Error('Missing keycode')
              execSync(`adb shell input keyevent ${args[0]}`)
              result = { success: true }
              break
            case 'adb_shell':
              if (!args || !args[0]) throw new Error('Missing command')
              result = execSync(`adb shell ${args[0]}`, { encoding: 'utf8' })
              break
            case 'fastboot_devices':
              result = execSync('fastboot devices', { 
                encoding: 'utf8',
                env: {
                  ...process.env,
                  PATH: '/opt/homebrew/bin:/usr/local/bin:' + (process.env.PATH || ''),
                  ANDROID_HOME: process.env.ANDROID_HOME || '',
                  ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT || ''
                }
              })
              break
            case 'fastboot_getvar':
              result = execSync('fastboot getvar all', { 
                encoding: 'utf8',
                env: {
                  ...process.env,
                  PATH: '/opt/homebrew/bin:/usr/local/bin:' + (process.env.PATH || ''),
                  ANDROID_HOME: process.env.ANDROID_HOME || '',
                  ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT || ''
                }
              })
              break
            case 'desktop_shell':
              if (!args || !args[0]) throw new Error('Missing command')
              result = execSync(args[0], { 
                encoding: 'utf8',
                env: {
                  ...process.env,
                  PATH: '/opt/homebrew/bin:/usr/local/bin:' + (process.env.PATH || '')
                }
              })
              break
            default:
              throw new Error('Unknown tool')
          }
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: true, result }))
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({
            success: false,
            error: err instanceof Error ? err.message : 'ADB command failed'
          }))
        }
        return
      }

      if (existsSync(staticDir)) {
        const safePath = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '')
        let filePath = join(staticDir, safePath === '/' ? 'index.html' : safePath)
        if (!existsSync(filePath) || statSync(filePath).isDirectory()) filePath = join(staticDir, 'index.html')
        if (existsSync(filePath)) {
          res.writeHead(200, { 'Content-Type': MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream' }).end(readFileSync(filePath))
          return
        }
      }
      res.writeHead(404).end('Not Found')
    } catch (err) {
      console.error('Gateway Server Error:', err)
      res.writeHead(500).end()
    }
  })

  return {
    start: () => new Promise((r) => server.listen(port, '0.0.0.0', () => { console.log(`Gateway on :${port}`); r() })),
    stop: () => new Promise((r, j) => server.close((e) => (e ? j(e) : r()))),
  }
}
