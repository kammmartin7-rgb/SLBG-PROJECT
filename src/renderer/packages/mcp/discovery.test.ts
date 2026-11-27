import { afterEach, expect, it, vi } from 'vitest'
import { discoveryTools } from './discovery'
const approve = vi.hoisted(() => vi.fn())
vi.mock('@/mobile/agent-approval', () => ({ requestAgentApproval: approve }))
afterEach(() => { vi.unstubAllGlobals(); approve.mockReset() })

it('discovers a catalog entry and sends the selected query only after approval', async () => {
  const api = discoveryTools('test-session')
  const options = { toolCallId: 'test', messages: [] }
  const catalog = await api.mcp_registry_search.execute!({ query: 'learn' }, options)
  expect(catalog).toHaveLength(1)
  const fetch = vi.fn(async (_url, init) => {
    const request = JSON.parse(init.body)
    if (request.id === undefined) return new Response(null, { status: 202 })
    const results: Record<string, unknown> = {
      initialize: { protocolVersion: request.params?.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'docs', version: '1' } },
      'tools/list': { tools: [{ name: 'microsoft_docs_search', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } }] },
      'tools/call': { content: [{ type: 'text', text: request.params?.arguments?.query }] }
    }
    return Response.json({ jsonrpc: '2.0', id: request.id, result: results[request.method] })
  })
  vi.stubGlobal('fetch', fetch)
  approve.mockResolvedValueOnce(false)
  const input = { id: 'microsoft-learn', query: 'desktop scheduling' }
  expect(await api.mcp_connect_remote.execute!(input, options)).toHaveProperty('error')
  expect(fetch).not.toHaveBeenCalled()
  approve.mockResolvedValueOnce(true)
  const result = await api.mcp_connect_remote.execute!(input, options)
  expect(result).toMatchObject({ content: [{ text: 'desktop scheduling' }] })
})
