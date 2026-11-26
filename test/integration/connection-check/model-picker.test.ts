import { expect, it, vi } from 'vitest'
import TestPlatform from '../../../src/renderer/platform/test_platform'
import { settings, newConfigs } from '@shared/defaults'
import { getModel } from '@shared/models'
import { getAllProviders } from '@shared/providers'
import { ModelProviderType, ModelProviderEnum as P } from '@shared/types'
import { createMockModelDependencies } from '../mocks/model-dependencies'
import { MockSentryAdapter } from '../mocks/sentry'

it.each([P.OpenAI, P.Claude, P.Gemini, P.DeepSeek, P.SiliconFlow, P.OpenRouter, P.Ollama])(
  'loads a model into the %s catalog from a mock provider response', async provider => {
    const deps = await createMockModelDependencies(new TestPlatform(), new MockSentryAdapter())
    const id = provider === P.Gemini ? 'gemini-fixture' : 'fixture-chat'
    const response = () => Response.json(provider === P.Gemini
      ? { models: [{ name: 'models/' + id, displayName: id, supportedGenerationMethods: ['generateContent'] }] }
      : { data: [{ id, object: 'model', type: 'model' }] })
    deps.request = { apiRequest: vi.fn(async () => response()), fetchWithOptions: vi.fn(async () => response()) }
    const model = getModel({ provider, modelId: id }, {
      ...settings(), providers: { [provider]: { apiKey: 'fixture-only', models: [{ modelId: id }] } },
    }, newConfigs(), deps)
    expect(await model.listModels!()).toEqual(expect.arrayContaining([expect.objectContaining({ modelId: id })]))
    expect(vi.mocked(deps.request.apiRequest).mock.calls.length + vi.mocked(deps.request.fetchWithOptions).mock.calls.length).toBeGreaterThan(0)
  }
)


it.each(getAllProviders().map(p => p.id))('constructs the registered %s adapter through session model selection', async (provider) => {
  const model = getModel({ provider, modelId: 'fixture' }, {
    ...settings(), providers: { [provider]: { apiKey: 'fixture-only', models: [{ modelId: 'fixture' }] } },
  }, newConfigs(), await createMockModelDependencies(new TestPlatform(), new MockSentryAdapter()))
  expect(typeof model.isSupportToolUse()).toBe('boolean')
})

function chatFixture(provider: string) {
  const text = 'The mock connection worked.'
  if (provider === P.Gemini) return { candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }] }
  if (provider === P.Claude) return {
    id: 'msg_test', model: 'fixture', role: 'assistant', type: 'message', stop_reason: 'end_turn',
    content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 },
  }
  if (provider === P.OpenAIResponses) return {
    id: 'resp_test', created_at: 1, model: 'fixture', status: 'completed',
    output: [{ id: 'msg_test', role: 'assistant', type: 'message', content: [{ type: 'output_text', text, annotations: [] }] }],
    usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
  }
  if (provider === P.VercelAIGateway) return { content: [{ type: 'text', text }], finishReason: { unified: 'stop' },
    usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } }, warnings: [] }
  if (provider === P.Bedrock) return { output: { message: { role: 'assistant', content: [{ text }] } }, stopReason: 'end_turn', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }
  return { id: 'test', object: 'chat.completion', created: 1, model: 'fixture',
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: text } }] }
}

const chatCases = [
  ...getAllProviders().map(p => ({ provider: p.id, protocol: p.id, custom: undefined })),
  ...[ModelProviderType.OpenAI, ModelProviderType.OpenAIResponses, ModelProviderType.Gemini, ModelProviderType.Claude]
    .map(type => ({ provider: 'fixture-' + type, protocol: type, custom: { id: 'fixture-' + type, type, name: type, isCustom: true as const } })),
]
it.each(chatCases)('reads an English chat completion through the $provider adapter', async ({ provider, protocol, custom }) => {
  const deps = await createMockModelDependencies(new TestPlatform(), new MockSentryAdapter())
  const request = vi.fn(async () => Response.json(chatFixture(protocol)))
  vi.stubGlobal('fetch', request)
  deps.request = { apiRequest: request, fetchWithOptions: request }
  deps.localInference = {
    isAvailable: async () => true,
    async *stream() { yield { type: 'text', text: 'The mock connection worked.' } },
  }
  try {
    const model = getModel({ provider, modelId: 'fixture', stream: false }, {
      ...settings(), customProviders: custom ? [custom] : [], providers: { [provider]: {
        apiHost: 'https://fixture.example', apiPath: '/v1/chat/completions', apiKey: 'fixture-only', accessKey: 'fixture-access', secretKey: 'fixture-secret',
        endpoint: 'https://fixture.openai.azure.com', models: [{ modelId: 'fixture' }],
      } },
    }, newConfigs(), deps)
    const response = await model.chat([{ role: 'user', content: 'Check the connection.' }], {})
    expect(response.contentParts).toContainEqual(expect.objectContaining({ type: 'text', text: 'The mock connection worked.' }))
    if (provider !== P.Local) expect(request).toHaveBeenCalled()
  } finally {
    vi.unstubAllGlobals()
  }
})
