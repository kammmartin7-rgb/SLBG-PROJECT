import { afterEach, expect, it, vi } from 'vitest'
import { MCPServer } from './controller'

vi.mock('@/mobile/agent-approval', () => ({ requestAgentApproval: vi.fn() }))
afterEach(() => vi.unstubAllGlobals())

it.each(['sse', 'streamable-http'] as const)('lists and invokes a tool with bearer authentication over %s', async protocol => {
  const url = 'https://fixture.example/mcp'
  const encoder = new TextEncoder()
  let events: ReadableStreamDefaultController<Uint8Array> | undefined
  const methods: string[] = []
  vi.stubGlobal('fetch', async (_input: RequestInfo, init: RequestInit) => {
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer fixture-only')
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
  const server = new MCPServer({ type: 'http', url, protocol, headers: { Authorization: 'Bearer fixture-only' } })
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
