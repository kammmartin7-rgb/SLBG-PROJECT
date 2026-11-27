import { expect, it } from 'vitest'
import { settings } from '@shared/defaults'
import { mergeSettingsConnections } from './-merge-settings-connections'

it('merges copies twice, retaining desktop MCP credentials and locally stored provider keys', () => {
  const server = (id: string, token: string) => ({
    id, name: id, enabled: true,
    transport: { type: 'http' as const, url: 'https://fixture.example/mcp', headers: { Authorization: token } },
  })
  const dest = { ...settings(), providers: { openai: { apiKey: 'desktop-fixture' } },
    mcp: { ...settings().mcp, servers: [server('shared', 'desktop'), server('desktop', 'desktop')] } }
  const source = { ...settings(), providers: { openai: { models: [{ modelId: 'fixture' }] } },
    mcp: { ...settings().mcp, servers: [server('shared', 'browser'), server('browser', 'browser')] } }
  const result = mergeSettingsConnections(structuredClone(dest), structuredClone(source))
  expect(result.mcp.servers).toEqual([...dest.mcp.servers, source.mcp.servers[1]])
  expect(result.providers?.openai).toEqual({ apiKey: 'desktop-fixture', models: [{ modelId: 'fixture' }] })
  expect(mergeSettingsConnections(result, source)).toEqual(result)
})
