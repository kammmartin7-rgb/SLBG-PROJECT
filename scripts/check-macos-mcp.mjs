import assert from 'node:assert/strict'
import { resolve, join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const app = resolve(process.argv[2])
const math = new StdioClientTransport({
  command: join(app, 'Contents/MacOS/SLBG PROJECT'),
  args: [join(app, 'Contents/Resources/app.asar.unpacked/math.cjs')],
  env: { ELECTRON_RUN_AS_NODE: '1' }
})
const docs = new StreamableHTTPClientTransport(new URL('https://learn.microsoft.com/api/mcp'))
for (const [transport, name, args] of [
  [math, 'gcd', { a: 84, b: 30 }],
  [docs, 'microsoft_docs_search', { query: 'Azure Functions overview' }]
]) {
  const client = new Client({ name: 'mac-build-check', version: '1' })
  try {
    await client.connect(transport)
    const { tools } = await client.listTools()
    assert(tools.some(tool => tool.name === name))
    const result = await client.callTool({ name, arguments: args })
    assert(!result.isError && result.content[0].type === 'text' && result.content[0].text.length > 0)
    if (name === 'gcd') assert.equal(result.content[0].text, '6')
    console.log('Passed discovery and call:', name)
  } finally {
    await client.close()
  }
}
