// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { webSearchTool, parseLinkTool } from '../model-calls/toolsets/web-search'
const fixture = vi.hoisted(() => ({ provider: 'bing' }))
vi.mock('@/platform', () => ({ default: { type: 'web' } }))
vi.mock('@/stores/settingActions', () => ({
  getLanguage: () => 'en', getExtensionSettings: () => ({ webSearch: {
    provider: fixture.provider, tavilyApiKey: 'fixture', bochaApiKey: 'fixture', queritApiKey: 'fixture',
  } }),
}))
vi.mock('ofetch', () => ({ ofetch: async (url: string) => {
  const link = 'https://fixture.example/page'
  if (url.includes('bing.com/news')) return '<div class="newsitem"><a class="title" href="' + link + '">News</a></div>'
  if (url.includes('bing.com')) return '<ul id="b_results"><li class="b_algo"><h2><a href="' + link + '">Search</a></h2></li></ul>'
  if (url.includes('bocha')) return { code: 200, data: { webPages: { value: [{ name: 'Bocha', url: link }] } } }
  if (url.includes('querit')) return { error_code: 200, results: { result: [{ title: 'Querit', url: link }] } }
  if (url.includes('/extract')) return { results: [{ url: link, raw_content: 'Fixture page' }] }
  return { results: [{ title: 'Tavily', url: link, content: 'Fixture' }] }
} }))
it.each(['build-in', 'bing', 'bocha', 'querit', 'tavily'])('dispatches web_search for the %s selection', async provider => {
  fixture.provider = provider
  const call = { toolCallId: 'fixture', messages: [] }
  const result = await webSearchTool.execute!({ query: 'test ' + provider }, call)
  expect(result).toHaveProperty('searchResults.0.link', 'https://fixture.example/page')
  if (provider === 'build-in' || provider === 'bing') expect(result).toHaveProperty('searchResults.1.title', 'News')
  if (provider === 'tavily') expect(await parseLinkTool.execute!({ url: 'https://fixture.example/page' }, call)).toHaveProperty('content', 'Fixture page')
})
