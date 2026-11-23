// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, waitFor as rtlWaitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { AgentSessionControls } from '../components/yachiyo/AgentSessionControls'

vi.mock('react-i18next', async (orig) => {
  const actual = await orig<typeof import('react-i18next')>()
  return { 
    ...actual, 
    useTranslation: () => ({ t: (k: string) => k }) 
  }
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
    workingDirectory: '' 
  }
  return {
    DEFAULT_AGENT_SESSION_CONFIG,
    getAgentSessionConfig: vi.fn(() => ({ ...DEFAULT_AGENT_SESSION_CONFIG })),
    saveAgentSessionConfig: vi.fn((_id: string, patch: Record<string, unknown>) => ({ 
      ...DEFAULT_AGENT_SESSION_CONFIG, 
      ...patch 
    }))
  }
})

vi.mock('@/mobile/character-profiles', () => {
  const DEFAULT_CHARACTER = { 
    id: 'default', 
    name: 'Default', 
    avatar: '', 
    prompt: '' 
  }
  return {
    DEFAULT_CHARACTER,
    listCharacterProfiles: () => [DEFAULT_CHARACTER],
    getSessionCharacter: () => DEFAULT_CHARACTER,
    selectSessionCharacter: vi.fn()
  }
})

vi.mock('@/mobile/agent-broker', () => ({
  getAgentBackend: vi.fn(() => 'accessibility'),
  setAgentBackend: vi.fn(),
  getAgentWorkingDirectory: vi.fn(() => ''),
  getCachedRootCapability: vi.fn(() => ({ available: false, detail: '' })),
  getRootCapability: vi.fn()
}))

vi.mock('@/mobile/agent-runtime-settings', () => ({
  getAgentRuntimeSettings: vi.fn(() => ({ 
    returnToAppOnComplete: false, 
    desktopControlEnabled: false 
  })),
  saveAgentRuntimeSettings: vi.fn()
}))

vi.mock('@/platform/native/yachiyo_device_access', () => ({
  yachiyoDeviceAccessNative: { 
    getPermissionStatus: async () => ({ 
      accessibility: true, 
      overlay: true, 
      shizukuGranted: false, 
      shizukuRunning: false 
    }), 
    probeBackend: async () => ({ ready: true, detail: 'ok' }), 
    openPermissionSettings: vi.fn() 
  }
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
      key: vi.fn() 
    })

    render(
      <MantineProvider>
        <AgentSessionControls 
          sessionId="test-session" 
          enabled 
          onToggle={async () => {}} 
          showStatus 
        />
      </MantineProvider>
    )

    // Open settings modal
    const settingsButton = screen.getByLabelText('Agent 设置')
    fireEvent.click(settingsButton)

    // Verify both control switches are enabled
    const desktopSwitch = screen.getByRole('switch', { name: 'PC / Desktop 控制' })
    const phoneSwitch = screen.getByRole('switch', { name: '手机控制' })
    expect(desktopSwitch).not.toBeDisabled()
    expect(phoneSwitch).not.toBeDisabled()

    // Toggle both controls on
    fireEvent.click(desktopSwitch)
    fireEvent.click(phoneSwitch)

    // Save settings
    const saveButton = screen.getByText('保存设置')
    fireEvent.click(saveButton)

    // Verify save was called with expected values
    await rtlWaitFor(() => {
      expect(vi.mocked(saveAgentSessionConfig)).toHaveBeenCalledWith(
        'test-session',
        expect.objectContaining({ 
          deviceControlEnabled: true, 
          desktopControlEnabled: true 
        })
      )
    })
  })
})
    // Mock localStorage
    const mockLocalStorage = {
      getItem: vi.fn((key: string) => {
        if (key === 'yachiyo.characters.v1') return JSON.stringify([{
          id: 'custom-char',
          name: 'Custom',
          avatar: '/avatar.png',
          prompt: 'Custom prompt',
          live2dModelId: 'default',
          defaultTtsProvider: 'bing',
          defaultTtsModel: 'edge-read-aloud'
        }])
        if (key === 'yachiyo-agent-presets') return JSON.stringify([{
          id: 'custom-agent',
          name: 'Custom Agent',
          systemPrompt: 'Agent prompt'
        }])
        return null
      }),
      setItem: vi.fn()
    }
    vi.stubGlobal('localStorage', mockLocalStorage)

    // Mock session config
    const mockConfig = {
      enabled: true,
      deviceControlEnabled: false,
      desktopControlEnabled: false,
      configured: true,
      backend: 'accessibility' as const,
      approvalMode: 'manual' as const,
      allowDangerousForConversation: false,
      workingDirectory: ''
    }
    vi.mock('@/mobile/agent-session-config', () => ({
      getAgentSessionConfig: vi.fn(() => mockConfig),
      saveAgentSessionConfig: vi.fn((_: string, patch: Partial<typeof mockConfig>) => {
        Object.assign(mockConfig, patch)
        return mockConfig
      }),
      defaultConfig: vi.fn(() => mockConfig)
    }))

    // Mock character profiles
    vi.mock('@/mobile/character-profiles', () => ({
      DEFAULT_CHARACTER: {
        id: 'default',
        name: 'Default',
        avatar: '/avatar.png',
        prompt: 'Default prompt',
        live2dModelId: 'default',
        defaultTtsProvider: 'bing',
        defaultTtsModel: 'edge-read-aloud'
      },
      listCharacterProfiles: vi.fn(() => [
        {
          id: 'default',
          name: 'Default',
          avatar: '/avatar.png',
          prompt: 'Default prompt',
          live2dModelId: 'default',
          defaultTtsProvider: 'bing',
          defaultTtsModel: 'edge-read-aloud'
        },
        {
          id: 'custom-char',
          name: 'Custom',
          avatar: '/avatar.png',
          prompt: 'Custom prompt',
          live2dModelId: 'default',
          defaultTtsProvider: 'bing',
          defaultTtsModel: 'edge-read-aloud'
        }
      ]),
      getSessionCharacter: vi.fn(() => ({
        id: 'default',
        name: 'Default',
        avatar: '/avatar.png',
        prompt: 'Default prompt',
        live2dModelId: 'default',
        defaultTtsProvider: 'bing',
        defaultTtsModel: 'edge-read-aloud'
      })),
      selectSessionCharacter: vi.fn(async () => {}),
      saveCharacterProfile: vi.fn()
    }))

    // Mock agent broker
    vi.mock('@/mobile/agent-broker', () => ({
      getAgentBackend: vi.fn(() => 'accessibility'),
      setAgentBackend: vi.fn(),
      getAgentWorkingDirectory: vi.fn(() => ''),
      getCachedRootCapability: vi.fn(() => ({ available: false, detail: '' })),
      getRootCapability: vi.fn()
    }))

    // Mock device access
    vi.mock('@/platform/native/yachiyo_device_access', () => ({
      yachiyoDeviceAccessNative: {
        getPermissionStatus: vi.fn(() => Promise.resolve({
          accessibility: true,
          overlay: true,
          shizukuGranted: false,
          shizukuRunning: false
        })),
        openPermissionSettings: vi.fn(),
        requestShizukuPermission: vi.fn()
      }
    }))

    // Mock agent runtime settings
    vi.mock('@/mobile/agent-runtime-settings', () => ({
      getAgentRuntimeSettings: vi.fn(() => ({ returnToAppOnComplete: false })),
      saveAgentRuntimeSettings: vi.fn()
    }))

    // Mock translation
    vi.mock('react-i18next', () => ({
      useTranslation: () => ({
        t: (key: string) => key
      })
    }))

    // Render component
    const { getByText, getByLabelText } = render(
      React.createElement(AgentSessionControls, {
        sessionId: "test-session",
        enabled: true,
        onToggle: async () => {},
        showStatus: true
      })
    )

    // Test Agent selector
    const selector = getByLabelText('Agent 预设')
    fireEvent.click(selector)
    expect(getByText('Default')).toBeTruthy()
    expect(getByText('Custom')).toBeTruthy()
    expect(getByText('Tool Agent')).toBeTruthy()
    expect(getByText('Custom Agent')).toBeTruthy()

    // Test control switches
    const phoneSwitch = getByLabelText('手机控制')
    const desktopSwitch = getByLabelText('PC / Desktop 控制')
    expect((phoneSwitch as HTMLInputElement).disabled).toBe(false)
    expect((desktopSwitch as HTMLInputElement).disabled).toBe(false)

    fireEvent.click(phoneSwitch)
    expect(mockConfig.deviceControlEnabled).toBe(true)

    fireEvent.click(desktopSwitch)
    expect(mockConfig.desktopControlEnabled).toBe(true)

    // Test save button
    const saveButton = getByText('保存设置')
    fireEvent.click(saveButton)
    expect(mockLocalStorage.setItem).toHaveBeenCalled()
    expect(mockConfig).toEqual({
      enabled: true,
      deviceControlEnabled: true,
      desktopControlEnabled: true,
      configured: true,
      backend: 'accessibility',
      approvalMode: 'manual',
      allowDangerousForConversation: false,
      workingDirectory: ''
    })
  })
})
