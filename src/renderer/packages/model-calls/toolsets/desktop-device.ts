import { tool } from 'ai'
import { z } from 'zod'
import { getAgentSessionConfig } from '@/mobile/agent-session-config'

type Bridge = { deviceTool(id: string, action: string, args: unknown): Promise<unknown> }
export function desktopBridge() {
  return (globalThis as typeof globalThis & { yachiyoDesktop?: Bridge }).yachiyoDesktop?.deviceTool
}
export function desktopDeviceTools(id: string) {
  const invoke = desktopBridge()
  if (!invoke) return {}
  function run(action: string, args: unknown) {
    if (action.startsWith('adb_') && !getAgentSessionConfig(id).deviceControlEnabled)
      throw Error('Enable PC / USB phone control in this conversation.')
    return invoke!(id, action, args)
  }
  const serial = z.string().min(1).max(128)
  const phone = getAgentSessionConfig(id).deviceControlEnabled
  return {
    run_workspace_code: tool({
      description: 'Run Python, TypeScript, or Git inside the conversation’s isolated persistent desktop workspace.',
      inputSchema: z.object({ language: z.enum(['python','typescript','git']), source: z.string().max(16000).optional(), args: z.array(z.string()).optional() }),
      execute: args => run('run_workspace_code', args)
    }),
    metis_latest_block: tool({ description: 'Read the latest block number on Metis mainnet.', inputSchema: z.object({}), execute: () => run('metis_latest_block', {}) }),
    browser_navigate: tool({ description: 'Open an HTTPS page in the separate desktop agent browser.', inputSchema: z.object({ url: z.string().url() }), execute: args => run('browser_navigate', args) }),
    browser_snapshot: tool({ description: 'Read the current page and numbered controls.', inputSchema: z.object({}), execute: args => run('browser_snapshot', args) }),
    browser_click: tool({ description: 'Click a numbered element from the latest snapshot.', inputSchema: z.object({ snapshot: z.string(), index: z.number().int().nonnegative() }), execute: args => run('browser_click', args) }),
    ...(phone ? {
      adb_devices: tool({ description: 'List connected ADB devices, models and authorization states.', inputSchema: z.object({}), execute: args => run('adb_devices', args) }),
      adb_device_info: tool({ description: 'Read the model of an authorized connected device.', inputSchema: z.object({ serial }), execute: args => run('adb_device_info', args) }),
      adb_ui_tree: tool({ description: 'Read visible controls and bounds on the selected phone after confirmation.', inputSchema: z.object({ serial }), execute: args => run('adb_ui_tree', args) }),
      adb_tap: tool({ description: 'Tap a specific screen coordinate on the selected phone after confirmation.', inputSchema: z.object({ serial, x: z.number().int(), y: z.number().int() }), execute: args => run('adb_tap', args) }),
    } : {}),
  }
}
