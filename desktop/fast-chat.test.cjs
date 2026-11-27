const { test } = require('node:test')
const assert = require('node:assert/strict')
const { hasToolTurn, compatiblePayload } = require('./fast-chat.cjs')

test('fast local tool turns preserve the tool schema, conversation and explicit reasoning preference', () => {
  const input = { model: 'qwen-local:latest', tools: [{ type: 'function' }], messages: [], stream: true }
  const prepare = payload => compatiblePayload(payload, hasToolTurn(payload))
  assert.deepEqual(prepare(input), { ...input, reasoning_effort: 'none' })
  const followup = { ...input, tools: [], messages: [{ role: 'tool', content: '12' }] }
  assert.deepEqual(prepare(followup), { ...followup, reasoning_effort: 'none' })
  for (const other of [{ ...input, model: 'another' }, { ...input, reasoning_effort: 'high' }, { ...input, tools: [] }]) {
    assert.equal(prepare(other), other)
  }
})
