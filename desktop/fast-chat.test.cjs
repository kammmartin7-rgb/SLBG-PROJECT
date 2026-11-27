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

test('an explicitly requested numeric answer uses the matching completed MCP call', async () => {
  const { directNumericReply } = require('./fast-chat.cjs')
  const messages = [
    { role: 'user', content: 'Use the tool. Reply with the returned number.' },
    { role: 'assistant', tool_calls: [{ id: 'one', function: { name: 'mcp__math__gcd' } }] },
    { role: 'tool', tool_call_id: 'one', content: JSON.stringify({ content: [{ type: 'text', text: '18' }] }) }
  ]
  const payload = { messages, model: 'local' }
  assert.equal((await directNumericReply(payload).json()).choices[0].message.content, '18')
  assert.match(await directNumericReply({ ...payload, stream: true }).text(), /data: \[DONE\]/)
  assert.equal(directNumericReply({ ...payload, messages: messages.slice(0, 2) }), null)
  assert.equal(directNumericReply({ ...payload, messages: [{ role: 'user', content: 'Explain the result' }, ...messages.slice(1)] }), null)
  assert.equal(directNumericReply({ ...payload, messages: [...messages.slice(0, 2), { ...messages[2], tool_call_id: 'other' }] }), null)
})
