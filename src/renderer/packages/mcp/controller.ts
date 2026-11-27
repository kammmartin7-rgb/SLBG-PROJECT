import { getActiveAgentProfile } from '@/mobile/agent-profile'
import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp'
import { Capacitor } from '@capacitor/core'
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { validateMobileMCPServerConfig } from '@shared/types/mcp'
import { CORE_AGENT_PRINCIPAL } from '@shared/agent'
import type { ToolSet } from 'ai'
import Emittery from 'emittery'
import { isEqual } from 'lodash'
import { requestAgentApproval } from '@/mobile/agent-approval'
import { mobileMcpController } from '@/mobile/mcp-mobile-controller'
import { createSafeMcpOAuthFetch } from '@/mobile/mcp-oauth-provider'
import type { MCPServerConfig, MCPServerStatus } from './types'

import { desktopTransport } from './desktop-transport'

type TransportConfig = MCPServerConfig['transport']
type MCPClient = Awaited<ReturnType<typeof createMCPClient>>

async function createClient(
  transportConfig: TransportConfig,
  name = 'chatbox-mcp-client',
  authProvider?: OAuthClientProvider
): Promise<MCPClient> {
  const desktop = desktopTransport(transportConfig)
  if (desktop) return createMCPClient({ name, transport: desktop })
  if (transportConfig.type === 'stdio') {
    // Only stdio services implemented by the native desktop bridge reach this client.
    throw new Error('This app cannot launch this stdio command. Use a supported desktop service or a remote MCP URL.')
  }
  if (transportConfig.type === 'http') {
    if ((transportConfig.oauth?.enabled && !authProvider) || transportConfig.secretRefs?.length) {
      throw new Error('This connection requires credential resolution before it can start.')
    }
    const safeFetch = createSafeMcpOAuthFetch()
    const createSseClient = async () => {
      const transport = new SSEClientTransport(new URL(transportConfig.url), {
        requestInit: { headers: transportConfig.headers },
        authProvider,
        fetch: safeFetch,
      })
      return createMCPClient({
        name,
        transport,
        onUncaughtError() {
          console.error('mcp:client:onUncaughtError')
        },
      })
    }
    if (transportConfig.protocol === 'sse') return createSseClient()
    try {
      const transport = new StreamableHTTPClientTransport(new URL(transportConfig.url), {
        requestInit: { headers: transportConfig.headers },
        authProvider,
        fetch: safeFetch,
      })
      return await createMCPClient({
        name,
        transport,
        onUncaughtError() {
          console.error('mcp:client:onUncaughtError')
        },
      })
    } catch (err) {
      console.error('Streamable HTTP connection failed')
      // OAuth errors must preserve the original PKCE transaction. Retrying via
      // SSE here would start a second authorization and overwrite its verifier.
      if (authProvider || transportConfig.protocol === 'streamable-http') throw err
      return createSseClient()
    }
  }
  throw new Error('Unknown transport type')
}

export class MCPServer extends Emittery<{ status: MCPServerStatus }> {
  private _status: MCPServerStatus = { state: 'idle' }
  private client?: MCPClient
  private tools?: ToolSet
  private stopped = false
  private checking = false

  constructor(
    private readonly transportConfig: TransportConfig,
    private readonly authProvider?: OAuthClientProvider
  ) {
    super()
  }

  get status() {
    return this._status
  }

  set status(status: MCPServerStatus) {
    this._status = status
    this.emit('status', status)
  }

  async start() {
    if (this.status.state !== 'idle') {
      return
    }
    this.status = { state: 'starting' }
    try {
      const client = await createClient(this.transportConfig, 'yachiyo-mcp-client', this.authProvider)
      if (this.stopped) { await client.close(); return }
      this.client = client
      this.tools = await client.tools()
      if (this.stopped) return
    } catch (err) {
      await this.client?.close().catch(() => undefined)
      this.client = undefined
      console.error('mcp:client:start')
      this.status = { state: 'idle', error: (err as Error).message }
      return
    }
    this.status = { state: 'running' }
  }

  async reconnectIfNeeded() {
    if (this.stopped || this.checking) return
    const config = this.transportConfig
    // Never replay a user-declined program launch or open an interactive OAuth flow on a timer.
    const bundled = config.type === 'stdio' && !Object.keys(config.env ?? {}).length &&
      ((config.command === 'yachiyo-math' && !config.args.length) ||
       (config.command === 'node' && config.args.length === 1 && config.args[0].endsWith('/slbg/desktop/kali-status.mjs') && 'yachiyoDesktop' in globalThis))
    if (!bundled && (config.type !== 'http' || config.oauth?.enabled || this.authProvider)) return
    this.checking = true
    try {
      if (this.status.state === 'running' && this.client) {
        try { await this.client.tools(); return } catch (error) {
          if (this.stopped) return
          await this.client.close().catch(() => undefined)
          this.client = undefined
          this.tools = undefined
          this.status = { state: 'idle', error: String(error) }
        }
      }
      if (!this.stopped && this.status.state === 'idle' &&
          !/401|403|unauthori|forbidden|denied|declined/i.test(this.status.error ?? '')) await this.start()
    } finally { this.checking = false }
  }

  async stop() {
    this.stopped = true
    this.status = { state: 'stopping' }
    await this.client?.close()
    this.tools = undefined
    this.status = { state: 'idle' }
  }

  getAvailableTools(): ToolSet {
    if (!this.client || this.status.state !== 'running') {
      return {}
    }
    return this.tools || {}
  }
}

// 根据用户配置管理MCP服务器的实际运行
export const mcpController = {
  servers: new Map<string, { instance: MCPServer; config: MCPServerConfig }>(),
  _statusSubscribers: new Map<string, Set<(status: MCPServerStatus) => void>>(),

  bootstrap(serverConfigs: MCPServerConfig[]) {
    for (const serverConfig of serverConfigs) {
      if (serverConfig.enabled) {
        void this.startServer(serverConfig)
      }
    }
  },

  async startServer(serverConfig: MCPServerConfig) {
    if (!serverConfig.enabled) {
      return
    }
    let runtimeTransport = serverConfig.transport
    let authProvider: OAuthClientProvider | undefined
    if (Capacitor.isNativePlatform()) {
      const validated = validateMobileMCPServerConfig(serverConfig)
      if (!validated.success) {
        console.error('mcp:mobile:config_rejected', validated.issues.map((issue) => issue.code).join(','))
        return
      }
      try {
        mobileMcpController.upsert(validated.data)
        const headers = await mobileMcpController.resolveHeaders(validated.data)
        authProvider = mobileMcpController.createOAuthProvider(validated.data)
        runtimeTransport = {
          type: 'http',
          url: validated.data.transport.url,
          protocol: validated.data.transport.protocol,
          headers: Object.keys(headers).length ? headers : undefined,
        }
      } catch {
        console.error('mcp:mobile:secret_resolution_failed')
        return
      }
    }
    const server = new MCPServer(runtimeTransport, authProvider)
    this.servers.set(serverConfig.id, { instance: server, config: serverConfig })

    // 如果有订阅者，重新连接他们
    const subscribers = this._statusSubscribers.get(serverConfig.id)
    if (subscribers) {
      subscribers.forEach((subscriber) => {
        server.on('status', subscriber)
      })
    }

    await server.start()
  },

  async completeMobileOAuth(callbackUrl: string): Promise<string> {
    if (!Capacitor.isNativePlatform()) throw new Error('mobile_mcp_oauth_native_only')
    const config = await mobileMcpController.finishOAuthCallback(callbackUrl)
    const { settingsStore } = await import('@/stores/settingsStore')
    settingsStore.getState().setSettings((draft) => {
      const index = draft.mcp.servers.findIndex((server) => server.id === config.id)
      if (index >= 0) draft.mcp.servers[index] = config
      else draft.mcp.servers.push(config)
    })
    await this.stopServer(config.id)
    await this.startServer(config)
    return config.id
  },

  async stopServer(id: string) {
    const server = this.servers.get(id)
    this.servers.delete(id)
    await server?.instance.stop()
    server?.instance.clearListeners()
  },

  async updateServer(serverConfig: MCPServerConfig) {
    if (!serverConfig.enabled) {
      await this.stopServer(serverConfig.id)
      return
    }
    const server = this.servers.get(serverConfig.id)
    if (!server) {
      await this.startServer(serverConfig)
      return
    }
    if (isEqual(server.config.transport, serverConfig.transport)) {
      server.config = serverConfig
    } else {
      await this.stopServer(serverConfig.id)
      await this.startServer(serverConfig)
    }
  },

  getServer(id: string): MCPServer | undefined {
    const server = this.servers.get(id)
    return server?.instance
  },

  subscribeToServerStatus(id: string, callback: (status: MCPServerStatus) => void) {
    let subscribers = this._statusSubscribers.get(id)
    if (!subscribers) {
      subscribers = new Set()
      this._statusSubscribers.set(id, subscribers)
    }
    subscribers.add(callback)

    const server = this.getServer(id)
    if (server) {
      server.on('status', callback)
      callback(server.status)
    }

    return () => {
      server?.off('status', callback)
      subscribers.delete(callback)
    }
  },

  getAvailableTools(sessionId?: string): ToolSet {
    const toolSet: ToolSet = {}
    for (const { instance, config } of this.servers.values()) {
      const pairedProfile = config.id.startsWith('paired-agent:') ? config.id.slice('paired-agent:'.length) : undefined
      if (pairedProfile !== undefined && pairedProfile !== getActiveAgentProfile().id) continue
      const mcpTools = instance.getAvailableTools()
      for (const [toolName, tool] of Object.entries(mcpTools)) {
        const rawExecute = tool.execute?.bind(tool)
        toolSet[normalizeToolName(config.name, toolName)] = {
          ...tool,
          execute: async (args, options) => {
            try {
              const approved = await requestAgentApproval({
                principal: CORE_AGENT_PRINCIPAL,
                sessionId,
                title: `MCP: ${config.name}/${toolName}`,
                detail: JSON.stringify(args, null, 2).slice(0, 4_000),
                risk: 'dangerous',
                signal: options.abortSignal,
              })
              if (!approved) return { error: 'user_denied_mcp_tool' }
              if (pairedProfile !== undefined && pairedProfile !== getActiveAgentProfile().id) return { error: 'agent_profile_changed' }
              return await rawExecute?.(args, options)
            } catch (err) {
              // 返回而非抛出，否则会导致流程中断
              return err
            }
          },
        }
      }
    }
    return toolSet
  },
}

const SERVER_NAME_REGEX = /^[A-Za-z0-9_-]+$/

function normalizeToolName(serverName: string, toolName: string) {
  serverName = serverName.replace(/\s+/g, '_')
  if (SERVER_NAME_REGEX.test(serverName)) {
    return `mcp__${serverName.toLowerCase()}__${toolName}`
  }
  return `mcp__${toolName}`
}
