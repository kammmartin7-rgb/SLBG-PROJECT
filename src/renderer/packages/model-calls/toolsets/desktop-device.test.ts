import type { ToolSet } from 'ai'
import { afterEach, expect, it, vi } from 'vitest'
import { desktopDeviceTools } from './desktop-device'
vi.mock('@/mobile/agent-session-config', () => ({ getAgentSessionConfig: () => ({ deviceControlEnabled: true }) }))
afterEach(() => vi.unstubAllGlobals())

it('dispatches each desktop chat tool through the desktop device bridge', async () => {
  const deviceTool = vi.fn(async () => 'fixture result')
  vi.stubGlobal('yachiyoDesktop', { deviceTool })
  const tools: ToolSet = desktopDeviceTools('fixture')
  const inputs = {
    run_workspace_code: { language: 'python', source: 'print(1)' }, metis_latest_block: {},
    browser_navigate: { url: 'https://example.org' }, browser_snapshot: {}, browser_click: { snapshot: 's', index: 1 },
    adb_devices: {}, adb_device_info: { serial: 'fixture' }, adb_ui_tree: { serial: 'fixture' },
    adb_tap: { serial: 'fixture', x: 1, y: 1 },
  }
  expect(Object.keys(tools).sort()).toEqual(Object.keys(inputs).sort())
  for (const [name, args] of Object.entries(inputs)) {
    const handler = tools[name as keyof typeof inputs]
    expect(await handler!.execute!(args, { toolCallId: 'test', messages: [] })).toBe('fixture result')
    expect(deviceTool).toHaveBeenLastCalledWith('fixture', name, args)
  }
})
