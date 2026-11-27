const test = require('node:test')
const assert = require('node:assert/strict')
const { metisBlock } = require('./metis.cjs')

test('Metis reader verifies the chain before reading the block and never sends a transaction', async t => {
  const calls = []
  let chain = '0x440'
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    const request = JSON.parse(Buffer.from(init.body).toString())
    calls.push(request.method)
    return Response.json({ jsonrpc: '2.0', id: request.id, result: request.method === 'eth_chainId' ? chain : '0x2a' })
  })
  assert.deepEqual(await metisBlock(), { chainId: 1088, block: '42' })
  assert.equal(calls[0], 'eth_chainId')
  assert.equal(calls.at(-1), 'eth_blockNumber')
  assert.ok(calls.every(method => ['eth_chainId','eth_blockNumber'].includes(method)))
  calls.length = 0
  chain = '0x1'
  await assert.rejects(metisBlock(), /Unexpected Metis chain ID/)
  assert.ok(calls.length > 0 && calls.every(method => method === 'eth_chainId'))
})
