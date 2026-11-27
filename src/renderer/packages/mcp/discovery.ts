import { CORE_AGENT_PRINCIPAL } from '@shared/agent'
import { tool } from 'ai'
import { z } from 'zod'
import { requestAgentApproval } from '@/mobile/agent-approval'
import { MCPServer } from './controller'

const catalog = [
  { id: 'microsoft-learn', name: 'Microsoft Learn documentation', url: 'https://learn.microsoft.com/api/mcp' },
]
export function discoveryTools(sessionId?: string) {
  return {
    mcp_registry_search: tool({
      description: 'Find a supported remote MCP server in the desktop and mobile catalog.',
      inputSchema: z.object({ query: z.string().max(256) }),
      execute: async ({ query }) => catalog.filter(entry => (entry.id + ' ' + entry.name).toLowerCase().includes(query.trim().toLowerCase()))
    }),
    mcp_connect_remote: tool({
      description: 'Discover tools on a catalog server, or run its documentation search with a query.',
      inputSchema: z.object({ id: z.string(), query: z.string().max(2000).optional() }),
      execute: async ({ id, query }) => {
        const entry = catalog.find(item => item.id === id)
        if (!entry) throw Error('Choose a server returned by mcp_registry_search.')
        const allowed = await requestAgentApproval({ principal: CORE_AGENT_PRINCIPAL, sessionId,
          title: 'Connect to ' + entry.name, detail: entry.url + (query ? '\nSearch: ' + query : ''), risk: 'dangerous' })
        if (!allowed) return { error: 'Connection declined' }
        const server = new MCPServer({ type: 'http', url: entry.url, protocol: 'streamable-http' })
        try {
          await server.start()
          if (server.status.state !== 'running') throw Error(server.status.error || 'Connection failed')
          const tools = server.getAvailableTools()
          if (!query) return { tools: Object.keys(tools) }
          const search = tools.microsoft_docs_search
          if (!search?.execute) throw Error('Documentation search unavailable')
          return await search.execute({ query }, { toolCallId: crypto.randomUUID(), messages: [] })
        } finally { await server.stop() }
      }
    })
  }
}
