// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { settings } from '@shared/defaults'
import { getAgentProfileState, saveAgentProfileState } from '@/mobile/agent-profile'
import { StorageKey } from '@/storage/StoreStorage'
import { ImportExportDataSection } from './general'

vi.mock('react-i18next', async importOriginal => ({
  ...await importOriginal<typeof import('react-i18next')>(),
  useTranslation: () => ({ t: (key: string) => key }),
}))
const fixture = vi.hoisted(() => ({ data: new Map<string, unknown>(), backup: '', relaunch: vi.fn() }))
vi.mock('@/storage', async () => ({
  StorageKey: (await import('@/storage/StoreStorage')).StorageKey,
  default: {
    getAllKeys: async () => [...fixture.data.keys()],
    getItem: async (key: string) => fixture.data.get(key),
    setItemNow: async (key: string, value: unknown) => fixture.data.set(key, value),
  },
}))
vi.mock('@/platform', () => ({ default: {
  exporter: { exportStreamingJson: async (_filename: string, generate: () => AsyncGenerator<string>) => {
    fixture.backup = ''
    for await (const chunk of generate()) fixture.backup += chunk
  } }, relaunch: fixture.relaunch,
} }))
vi.mock('@/stores/chatStore', () => ({ getMetaStorage: async () => ({ getAll: async () => [] }) }))
vi.mock('@/router', () => ({ router: {} }))
vi.mock('@/stores/settingsStore', () => ({ useSettingsStore: vi.fn() }))

it('exports and restores a copy using the Settings buttons', async () => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} })
  const server = (id: string) => ({ id, name: id, enabled: true, transport: { type: 'http', url: 'https://fixture.example/mcp' } })
  const source = { ...settings(), providers: { openai: { apiKey: 'source-fixture' } }, mcp: { servers: [server('source')], enabledBuiltinServers: [] } }
  fixture.data.set(StorageKey.ConfigVersion, 15)
  fixture.data.set(StorageKey.Settings, source)
  saveAgentProfileState({ activeProfileId: 'source', profiles: [{ id: 'source', name: 'Source', soul: 'Source agent' }] })
  const { container } = render(<MantineProvider><ImportExportDataSection /></MantineProvider>)
  fireEvent.click(screen.getByText('Export Selected Data'))
  await waitFor(() => expect(JSON.parse(fixture.backup).__agent_profiles.activeProfileId).toBe('source'))
  expect(fixture.backup).not.toContain('source-fixture')
  fixture.data.set(StorageKey.Settings, { ...settings(), providers: { openai: { apiKey: 'target-fixture' } }, mcp: { servers: [server('target')], enabledBuiltinServers: [] } })
  saveAgentProfileState({ activeProfileId: 'target', profiles: [{ id: 'target', name: 'Target', soul: 'Target agent' }] })
  fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [new File([fixture.backup], 'copy.json', { type: 'application/json' })] } })
  await waitFor(() => expect(fixture.relaunch).toHaveBeenCalledOnce())
  expect(fixture.data.get(StorageKey.Settings)).toMatchObject({
    mcp: { servers: [server('target'), server('source')] }, providers: { openai: { apiKey: 'target-fixture' } },
  })
  expect(getAgentProfileState().profiles.map(p => p.id)).toEqual(expect.arrayContaining(['source', 'target']))
  expect(getAgentProfileState().activeProfileId).toBe('target')
})
