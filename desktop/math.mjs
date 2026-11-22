import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new McpServer({ name: 'Yachiyo Discrete Math', version: '1.0.0' })
server.registerTool('gcd', {
  description: 'Greatest common divisor of two safe integers.',
  inputSchema: { a: z.number().int().safe(), b: z.number().int().safe() },
  annotations: { readOnlyHint: true, idempotentHint: true }
}, ({ a, b }) => {
  let x = BigInt(Math.abs(a))
  let y = BigInt(Math.abs(b))
  while (y) [x, y] = [y, x % y]
  return { content: [{ type: 'text', text: x.toString() }] }
})
void server.connect(new StdioServerTransport())
