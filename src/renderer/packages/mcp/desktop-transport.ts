import type { JSONRPCMessage, MCPTransport } from '@ai-sdk/mcp'
import type { MCPServerConfig } from './types'

type Service = 'learn' | 'math'
interface DesktopBridge {
  open(service: Service): Promise<string>
  close(id: string): Promise<void>
  send(id: string, message: JSONRPCMessage): Promise<void>
  subscribe(callback: (id: string, type: string, value: JSONRPCMessage) => void): () => void
}

export function desktopTransport(config: MCPServerConfig['transport']): MCPTransport | undefined {
  const bridge = (globalThis as typeof globalThis & { yachiyoDesktop?: DesktopBridge }).yachiyoDesktop
  if (!bridge) return
  let service: Service
  if (config.type === 'stdio') {
    if (config.command !== 'yachiyo-math' || config.args.length || Object.keys(config.env ?? {}).length)
      throw new Error('Select yachiyo-math with no arguments or environment variables for local discrete math.')
    service = 'math'
  } else if (config.url === 'https://learn.microsoft.com/api/mcp' && !config.oauth?.enabled &&
    !config.secretRefs?.length && !Object.keys(config.headers ?? {}).length && config.protocol !== 'sse') {
    service = 'learn'
  } else return
  let id: string | undefined
  let unsubscribe: (() => void) | undefined
  const transport: MCPTransport = {
    async start() {
      id = await bridge.open(service)
      unsubscribe = bridge.subscribe((source, type, value) => {
        if (source !== id) return
        if (type === 'message') transport.onmessage?.(value)
        if (type === 'error') transport.onerror?.(new Error('Desktop MCP transport failed'))
        if (type === 'close') { unsubscribe?.(); transport.onclose?.() }
      })
    },
    async send(message) {
      if (!id) throw new Error('Desktop connection is closed')
      await bridge.send(id, message)
    },
    async close() {
      unsubscribe?.()
      if (id) await bridge.close(id)
      id = undefined
    }
  }
  return transport
}
