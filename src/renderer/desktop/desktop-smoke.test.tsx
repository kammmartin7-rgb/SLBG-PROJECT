// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, waitFor as rtlWaitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { AgentSessionControls } from '../components/yachiyo/AgentSessionControls'

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
})

vi.mock('react-i18next', async (orig) => {
  const actual = await orig<typeof import('react-i18next')>()
  return { ...actual, useTranslation: () => ({ t: (k: string) => k }) }
})

vi.mock('@/mobile/agent-session-config', () => {
  const DEFAULT_AGENT_SESSION_CONFIG = {
    enabled: true,
    deviceControlEnabled: false,
    desktopControlEnabled: false,
    configured: true,
    backend: 'accessibility' as const,
    approvalMode: 'manual' as const,
    allowDangerousForConversation: false,
    workingDirectory: '',
  }
  return {
    DEFAULT_AGENT_SESSION_CONFIG,
    getAgentSessionConfig: vi.fn(() => ({ ...DEFAULT_AGENT_SESSION_CONFIG })),
    saveAgentSessionConfig: vi.fn((_id: string, patch: Record<string, unknown>) => ({
      ...DEFAULT_AGENT_SESSION_CONFIG,
      ...patch,
    })),
  }
})

vi.mock('@/mobile/character-profiles', () => {
  const DEFAULT_CHARACTER = { id: 'default', name: 'Default', avatar: '', prompt: '' }
  return {
    DEFAULT_CHARACTER,
    listCharacterProfiles: () => [DEFAULT_CHARACTER],
    getSessionCharacter: () => DEFAULT_CHARACTER,
    selectSessionCharacter: vi.fn(),
  }
})

vi.mock('@/mobile/agent-broker', () => ({
  getAgentBackend: vi.fn(() => 'accessibility'),
  setAgentBackend: vi.fn(),
  getAgentWorkingDirectory: vi.fn(() => ''),
  getCachedRootCapability: vi.fn(() => ({ available: false, detail: '' })),
  getRootCapability: vi.fn(),
}))

vi.mock('@/mobile/agent-runtime-settings', () => ({
  getAgentRuntimeSettings: vi.fn(() => ({ returnToAppOnComplete: false, desktopControlEnabled: false })),
  saveAgentRuntimeSettings: vi.fn(),
}))

vi.mock('@/platform/native/yachiyo_device_access', () => ({
  yachiyoDeviceAccessNative: {
    getPermissionStatus: async () => ({ accessibility: true, overlay: true, shizukuGranted: false, shizukuRunning: false }),
    probeBackend: async () => ({ ready: true, detail: 'ok' }),
    openPermissionSettings: vi.fn(),
  },
}))

describe('Desktop & Cross-Platform Smoke Checks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows toggling device controls in desktop mode', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    })

    render(
      <MantineProvider>
        <AgentSessionControls sessionId="test-session" enabled onToggle={async () => {}} showStatus />
      </MantineProvider>
    )

    const settingsButton = screen.getByLabelText('Agent 设置')
    fireEvent.click(settingsButton)

    // Wait for modal content to load
    await screen.findByText('手机控制')

    // Get switches via their labels
    const getSwitch = (text: string) => {
      const label = screen.getByText(text).closest('label')
      return (label?.querySelector('input') || screen.getByLabelText(text)) as HTMLInputElement
    }

    const desktopSwitch = getSwitch('PC / Desktop 控制')
    const phoneSwitch = getSwitch('手机控制')

    // Verify switches are enabled
    expect(desktopSwitch.disabled).toBe(false)
    expect(phoneSwitch.disabled).toBe(false)

    // Toggle switches
    fireEvent.click(desktopSwitch)
    fireEvent.click(phoneSwitch)

    // Save settings
    const saveButton = screen.getByText('保存设置')
    fireEvent.click(saveButton)

    // Verify save was called
    const { saveAgentSessionConfig } = await import('@/mobile/agent-session-config')
    await waitFor(() => {
      expect(saveAgentSessionConfig).toHaveBeenCalledWith(
        'test-session',
        expect.objectContaining({
          deviceControlEnabled: true,
          desktopControlEnabled: true
        })
      )
    })
  })
})
