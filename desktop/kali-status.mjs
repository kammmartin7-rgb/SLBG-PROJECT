import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const endpoint = new URL('http://192.168.64.2:8001/mcp')
const server = new McpServer({ name: 'Kali VM status', version: '1.0.0' })

async function callKali(tool) {
  const client = new Client({ name: 'slbg-status', version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(endpoint, {
    fetch: (url, options) => fetch(url, { ...options, redirect: 'error' })
  })
  try {
    await client.connect(transport, { timeout: 5000 })
    if (client.getServerVersion()?.name !== 'Kali VM Status') throw new Error('Unexpected MCP service')
    return await client.callTool({ name: tool, arguments: {} }, undefined, { timeout: 5000 })
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: 'Kali MCP unavailable at ' + endpoint.href + ': ' + error.message }] }
  } finally {
    await client.close()
  }
}
const operations = [
  ['kali_mcp_status', 'kali_status', 'Read the Kali OS version, uptime and system service manager state.'],
  ['kali_disk_space', 'disk_space', 'Check total, used and available space on the Kali root filesystem.'],
  ['kali_memory', 'memory_usage', 'Check RAM and swap usage in Kali.']
]
for (const [name, remote, description] of operations) {
  server.registerTool(name, {
    description, inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true }
  }, () => callKali(remote))
}
await server.connect(new StdioServerTransport())
