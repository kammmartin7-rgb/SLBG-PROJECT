const { createServer } = require('node:http')
const { randomBytes, timingSafeEqual } = require('node:crypto')
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js')
const { z } = require('zod')

function pairedAgent(profile, ask, workflows) {
  if (typeof profile !== 'string' || !profile.trim() || profile.length > 256) throw Error('Select an agent profile')
  const secret = randomBytes(32).toString('base64url')
  const expected = Buffer.from('Bearer ' + secret)
  function authenticated(header) {
    const supplied = Buffer.from(header || '')
    return supplied.length === expected.length && timingSafeEqual(supplied, expected)
  }
  function service() {
    const mcp = new McpServer({ name: 'Yachiyo paired desktop', version: '1' })
    const reply = text => ({ content: [{ type: 'text', text }] })
    mcp.registerTool('agent_identity', { annotations: { readOnlyHint: true }, inputSchema: {} },
      () => reply(profile))
    mcp.registerTool('ask_desktop', { description: 'Ask the local desktop model a question', inputSchema: {
      question: z.string().min(1).max(4000)
    } }, async ({ question }) => reply(await ask(question)))
    mcp.registerTool('metis_latest_block', { description: 'Read the latest Metis mainnet block number.',
      inputSchema: {}, annotations: { readOnlyHint: true } },
      async () => reply(JSON.stringify(await require('./metis.cjs').metisBlock())))
    if (workflows) {
      mcp.registerTool('start_desktop_workflow', {
        description: 'Queue a question on the desktop and return its job ID.',
        inputSchema: { question: z.string().min(1).max(4000) }
      }, ({ question }) => reply(JSON.stringify(workflows.submit(profile, question))))
      mcp.registerTool('poll_workflow_status', {
        description: 'Get the status and completed answer of a desktop job.',
        annotations: { readOnlyHint: true }, inputSchema: { job_id: z.string().uuid() }
      }, ({ job_id }) => reply(JSON.stringify(workflows.poll(profile, job_id))))
    }
    return mcp
  }
  return { secret, authenticated, service }
}

async function startPair(profile, ask, workflows) {
  const pair = pairedAgent(profile, ask, workflows)
  let active = 0
  const http = createServer(async (req, res) => {
    if (req.url !== '/mcp') return res.writeHead(404).end()
    const origin = req.headers.origin
    if (origin && !['https://localhost', 'yachiyo://app'].includes(origin)) return res.writeHead(403).end()
    if (origin) {
      res.setHeader('access-control-allow-origin', origin)
      res.setHeader('vary', 'Origin')
      res.setHeader('access-control-allow-methods', 'POST, OPTIONS')
      res.setHeader('access-control-allow-headers', 'authorization, content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id')
    }
    if (req.method === 'OPTIONS') return res.writeHead(204).end()
    if (req.method !== 'POST') return res.writeHead(405).end()
    if (!pair.authenticated(req.headers.authorization)) return res.writeHead(401).end()
    if (active >= 4) return res.writeHead(429).end()
    active++
    const service = pair.service()
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    res.once('close', () => { active--; void service.close().catch(() => {}) })
    try {
      await service.connect(transport)
      await transport.handleRequest(req, res)
    } catch {
      if (!res.headersSent) res.writeHead(500)
      res.end()
    }
  })
  await new Promise((resolve, reject) => { http.once('error', reject); http.listen(0, '127.0.0.1', resolve) })
  return { secret: pair.secret, port: http.address().port, close() { http.close(); http.closeAllConnections() } }
}

async function askLocalModel(question) {
  const response = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST', headers: { 'content-type': 'application/json' }, redirect: 'error',
    body: JSON.stringify({ model: 'qwen-local:latest', messages: [{ role: 'user', content: question }],
      think: false, stream: false, options: { num_predict: 512 } }), signal: AbortSignal.timeout(90000)
  })
  if (!response.ok) throw Error('Desktop Ollama model unavailable')
  const answer = (await response.json()).message?.content
  if (!answer) throw Error('Desktop returned an empty answer')
  return answer
}
module.exports = { pairedAgent, startPair, askLocalModel }

// Verify both credentials through the HTTP transport before showing a new pairing.
async function checkPair(pair, profile) {
  const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
  const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js')
  const url = new URL('http://127.0.0.1:' + pair.port + '/mcp')
  const denied = await fetch(url, { method: 'POST', headers: { authorization: 'Bearer wrong' }, signal: AbortSignal.timeout(3000) })
  if (denied.status !== 401) throw Error('Desktop accepted an invalid pairing credential')
  const client = new Client({ name: 'Yachiyo pairing check', version: '1' })
  try {
    await client.connect(new StreamableHTTPClientTransport(url, {
      requestInit: { headers: { authorization: 'Bearer ' + pair.secret } }
    }), { timeout: 5000 })
    const result = await client.callTool({ name: 'agent_identity', arguments: {} })
    if (result.content?.[0]?.text !== profile) throw Error('Paired agent identity mismatch')
  } finally { await client.close() }
}
module.exports.checkPair = checkPair
