const test = require('node:test')
const assert = require('node:assert/strict')
const { join } = require('node:path')
const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js')
const { approvedStdio } = require('./stdio-launcher.cjs')
const { pairedAgent } = require('./paired-agent.cjs')

test('an explicitly approved external Node process serves MCP over stdio', async () => {
  const command = { command: process.execPath, args: [join(__dirname, 'math.mjs')] }
  const transport = await approvedStdio(command, async detail => {
    assert.deepEqual(JSON.parse(detail).arguments, command.args)
    return true
  })
  const client = new Client({ name: 'external-process-test', version: '1' })
  try {
    await client.connect(transport)
    const result = await client.callTool({ name: 'gcd', arguments: { a: 84, b: 30 } })
    assert.equal(result.content[0].text, '6')
  } finally { await client.close() }
})

test('denying native launch leaves the process unstarted', async () => {
  await assert.rejects(approvedStdio({ command: 'node', args: [] }, async () => false), /declined/)
})

test('pair credentials are agent-specific and identity is returned by the MCP server', async () => {
  const alice = pairedAgent('agent-a', async () => 'answer-a')
  const bob = pairedAgent('agent-b', async () => 'answer-b')
  assert.equal(alice.authenticated('Bearer ' + alice.secret), true)
  assert.equal(bob.authenticated('Bearer ' + alice.secret), false)
  assert.equal(alice.authenticated('Bearer ' + bob.secret), false)
  assert.equal(alice.authenticated(''), false)
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'identity-test', version: '1' })
  const server = alice.service()
  try {
    await server.connect(serverSide)
    await client.connect(clientSide)
    const result = await client.callTool({ name: 'agent_identity', arguments: {} })
    assert.equal(result.content[0].text, 'agent-a')
    const answer = await client.callTool({ name: 'ask_desktop', arguments: { question: 'Hello' } })
    assert.equal(answer.content[0].text, 'answer-a')
  } finally { await client.close(); await server.close() }
})

test('desktop workflow survives reopening and only answers its paired agent', async () => {
  const fs = require('node:fs')
  const os = require('node:os')
  const { desktopWorkflows } = require('./workflows.cjs')
  const root = fs.mkdtempSync(join(os.tmpdir(), 'desktop-workflow-'))
  let queue
  try {
    queue = desktopWorkflows(root, async question => question.toUpperCase())
    const { job_id } = queue.submit('first', 'test')
    assert.throws(() => queue.poll('second', job_id), /Unknown workflow/)
    queue.close()
    queue = desktopWorkflows(root, async question => question.toUpperCase())
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(queue.poll('first', job_id), { job_id, status: 'completed', answer: 'TEST' })
    queue.close()
    queue = desktopWorkflows(root, async () => { throw Error('must not replay') })
    assert.equal(queue.poll('first', job_id).answer, 'TEST')
  } finally { queue?.close(); fs.rmSync(root, { recursive: true, force: true }) }
})
