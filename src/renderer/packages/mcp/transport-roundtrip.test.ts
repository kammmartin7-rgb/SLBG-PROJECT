import { afterEach, expect, it, vi } from 'vitest'
import { MCP_ENTRIES_COMMUNITY, MCP_ENTRIES_OFFICIAL } from '@/components/settings/mcp/registries'
import { parseServerFromJson } from '@/components/settings/mcp/utils'
import { BUILTIN_MCP_SERVERS, getBuiltinServerConfig } from './builtin'
import { MCPServer } from './controller'

vi.mock('@/mobile/agent-approval', () => ({ requestAgentApproval: vi.fn() }))
afterEach(() => vi.unstubAllGlobals())

const cases = [
  ...(['sse', 'streamable-http'] as const).map(protocol => ({
    name: protocol, protocol, url: 'https://fixture.example/mcp', headers: { Authorization: 'Bearer fixture-only' } as Record<string, string>,
  })),
  ...BUILTIN_MCP_SERVERS.map(({ id }) => {
    const config = getBuiltinServerConfig(id, 'fixture-license')
    if (config?.transport.type !== 'http') throw Error('Expected HTTP preset ' + id)
    return { name: id, protocol: 'streamable-http' as const, url: config.transport.url, headers: config.transport.headers! }
  }),
]

it.each(cases)('lists and invokes a tool through $name', async ({ protocol, url, headers }) => {
  const encoder = new TextEncoder()
  let events: ReadableStreamDefaultController<Uint8Array> | undefined
  const methods: string[] = []
  vi.stubGlobal('fetch', async (_input: RequestInfo, init: RequestInit) => {
    expect(String(_input)).toContain(new URL(url).origin)
    for (const [key, value] of Object.entries(headers)) expect(new Headers(init.headers).get(key)).toBe(value)
    if (protocol === 'sse' && init.method !== 'POST') {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          events = controller
          controller.enqueue(encoder.encode('event: endpoint\ndata: /messages\n\n'))
        },
      })
      return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
    }
    const request = JSON.parse(String(init.body))
    methods.push(request.method)
    if (request.id === undefined) return new Response(null, { status: 202 })
    const results: Record<string, unknown> = {
      initialize: { protocolVersion: request.params?.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'fixture', version: '1' } },
      'tools/list': { tools: [{ name: 'echo', inputSchema: { type: 'object', properties: { text: { type: 'string' } } } }] },
      'tools/call': { content: [{ type: 'text', text: request.params?.arguments?.text }] },
    }
    const reply = { jsonrpc: '2.0', id: request.id, result: results[request.method] }
    if (protocol === 'streamable-http') return Response.json(reply)
    events!.enqueue(encoder.encode('event: message\ndata: ' + JSON.stringify(reply) + '\n\n'))
    return new Response(null, { status: 202 })
  })
  const server = new MCPServer({ type: 'http', url, protocol, headers })
  if (url === 'https://fixture.example/mcp' && protocol === 'streamable-http') {
    const healthyFetch = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network offline')))
    await server.start()
    expect(server.status.state).toBe('idle')
    vi.stubGlobal('fetch', healthyFetch)
    await server.reconnectIfNeeded()
    expect(server.status.state).toBe('running')
  }
  try {
    await server.start()
    expect(server.status).toEqual({ state: 'running' })
    const result = await server.getAvailableTools().echo.execute!({ text: 'roundtrip' }, { toolCallId: 'test', messages: [] })
    expect(result).toMatchObject({ content: [{ type: 'text', text: 'roundtrip' }] })
    expect(methods).toContain('tools/call')
  } finally {
    await server.stop()
    events?.close()
  }
})

it('does not attempt an anonymous connection when OAuth is configured without a provider', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const server = new MCPServer({
    type: 'http', url: 'https://fixture.example/mcp',
    oauth: { enabled: true, redirectUri: 'yachiyoclaw://oauth/mcp' },
  })
  await server.start()
  expect(server.status).toMatchObject({ state: 'idle', error: expect.stringContaining('credential') })
  expect(fetch).not.toHaveBeenCalled()
})


it.each([...MCP_ENTRIES_OFFICIAL, ...MCP_ENTRIES_COMMUNITY])('parses the $name stdio preset and forwards its exact launch request', async entry => {
  const config = parseServerFromJson(JSON.stringify(entry.configuration))!
  expect(config.transport).toMatchObject({ type: 'stdio', ...entry.configuration })
  const open = vi.fn().mockRejectedValue(Error('Local MCP launch declined'))
  vi.stubGlobal('yachiyoDesktop', { open })
  const server = new MCPServer(config.transport)
  await server.start()
  expect(server.status).toMatchObject({ state: 'idle', error: 'Local MCP launch declined' })
  expect(open).toHaveBeenCalledWith(config.transport)
})
