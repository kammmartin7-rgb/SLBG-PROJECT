const { createInterface } = require('node:readline')
const { Readable } = require('node:stream')
const { YACHIYO_SOUL } = require('../src/shared/personas/yachiyo.ts')

const concisePersona = 'You are Yachiyo. Answer directly in the user’s language. Give details when requested.'
const chatUrl = 'http://127.0.0.1:11434/api/chat'

function nativeMessages(payload) {
  if (!Array.isArray(payload.messages)) return null
  const messages = []
  for (const message of payload.messages) {
    if (!['system', 'assistant', 'user'].includes(message.role)) return null
    let content = message.content
    if (Array.isArray(content) && content.every(part => part.type === 'text')) {
      content = content.map(part => part.text).join('\n')
    }
    if (typeof content !== 'string') return null
    if (message.role === 'system') content = content.replace(YACHIYO_SOUL, concisePersona)
    messages.push({ role: message.role, content })
  }
  return messages
}

exports.fastChat = async function fastChat(payload, signal) {
  if (payload.model !== 'qwen-local:latest' || payload.response_format) return null
  const messages = nativeMessages(payload)
  if (!messages) return null
  const options = { temperature: payload.temperature, top_p: payload.top_p,
    num_predict: payload.max_completion_tokens ?? payload.max_tokens, stop: payload.stop }
  const stream = payload.stream === true
  const upstream = await fetch(chatUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'error', signal,
    body: JSON.stringify({ model: payload.model, messages, options, think: false, keep_alive: '15m', stream })
  })
  if (!upstream.ok) return upstream
  const common = { id: 'chatcmpl-' + require('node:crypto').randomUUID(), model: payload.model,
    created: Math.floor(Date.now() / 1000) }
  if (!stream) {
    const result = await upstream.json()
    return Response.json({ ...common, object: 'chat.completion', choices: [{ index: 0,
      message: { role: 'assistant', content: result.message.content }, finish_reason: result.done_reason || 'stop' }] })
  }
  async function* chunks() {
    const source = Readable.fromWeb(upstream.body)
    const lines = createInterface({ input: source, crlfDelay: Infinity })
    try {
      for await (const line of lines) {
        if (!line.trim()) continue
        const part = JSON.parse(line)
        if (part.error) throw Error('Ollama generation failed')
        const chunk = { ...common, object: 'chat.completion.chunk', choices: [{ index: 0,
          delta: { role: 'assistant', content: part.message?.content || '' },
          finish_reason: part.done ? part.done_reason || 'stop' : null }] }
        yield Buffer.from('data: ' + JSON.stringify(chunk) + '\n\n')
        if (part.done) { yield Buffer.from('data: [DONE]\n\n'); return }
      }
      throw Error('Ollama stream ended before completion')
    } finally { lines.close(); source.destroy() }
  }
  return new Response(Readable.toWeb(Readable.from(chunks())), { headers: { 'Content-Type': 'text/event-stream' } })
}
