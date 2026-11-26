import { expect, it, vi } from 'vitest'
import TestPlatform from '../../../src/renderer/platform/test_platform'
import { settings, newConfigs } from '@shared/defaults'
import { getModel } from '@shared/models'
import { ModelProviderEnum as P } from '@shared/types'
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
