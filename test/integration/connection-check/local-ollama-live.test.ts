import { expect, it } from 'vitest'
import { settings, newConfigs } from '@shared/defaults'
import { getModel } from '@shared/models'
import TestPlatform from '../../../src/renderer/platform/test_platform'
import { createMockModelDependencies } from '../mocks/model-dependencies'
import { MockSentryAdapter } from '../mocks/sentry'

it.runIf(process.env.YACHIYO_LIVE_OLLAMA_MODEL)('fetches the configured local model and generates English through its adapter', async () => {
  const id = process.env.YACHIYO_LIVE_OLLAMA_MODEL!
  const deps = await createMockModelDependencies(new TestPlatform(), new MockSentryAdapter())
  const model = getModel({ provider: 'ollama', modelId: id, stream: false, maxTokens: 64 }, {
    ...settings(), providers: { ollama: { apiHost: 'http://127.0.0.1:11434', models: [{ modelId: id }] } },
  }, newConfigs(), deps)
  expect(await model.listModels!()).toEqual(expect.arrayContaining([expect.objectContaining({ modelId: id })]))
  const result = await model.chat([{ role: 'user', content: 'Reply with only the English word peach. /no_think' }], { signal: AbortSignal.timeout(90000) })
  expect(result.contentParts).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'text', text: expect.stringMatching(/peach/i) })]))
}, 100000)
