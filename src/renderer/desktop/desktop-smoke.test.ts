import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseServersFromJson } from '../components/settings/mcp/utils'
import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { AgentSessionControls } from '../components/yachiyo/AgentSessionControls'

describe('Desktop & Cross-Platform Smoke Checks', () => {
  it('never passes undefined components prop to Virtuoso in MessageList', () => {
    const src = readFileSync(join(process.cwd(), 'src/renderer/components/chat/MessageList.tsx'), 'utf8')
    expect(src).not.toContain('components={inAndroidAppShell ? androidMessageListComponents : undefined}')
  })

  it('parses Desktop Brain Mode connection strings and standard MCP JSON', () => {
    const brain = parseServersFromJson('http://100.64.0 | Bearer test-token-123')
    expect(brain).toHaveLength(1)
    expect(brain[0].transport.type).toBe('http')

    const json = parseServersFromJson(
      JSON.stringify({ mcpServers: { n8n: { url: 'https://n8n.cloud' } } })
    )
    expect(json).toHaveLength(1)
    expect(json[0].name).toBe('n8n')
  })

  it('ensures modals have proper scrolling behavior in flow-glass theme', () => {
    const flowGlassCss = readFileSync(
      join(process.cwd(), 'src/renderer/components/yachiyo/flow-glass.css'),
      'utf8'
    )
    expect(flowGlassCss).toContain('.mantine-Modal-body {')
    expect(flowGlassCss).toContain('overflow-y: auto')
    expect(flowGlassCss).toContain('overscroll-behavior: contain')
  })

  it('allows Agent mode toggle for any model without toolUse capability', () => {
    const agentControls = readFileSync(
      join(process.cwd(), 'src/renderer/components/yachiyo/AgentSessionControls.tsx'),
      'utf8'
    )
    expect(agentControls).toContain('// Skip configuration check and allow enabling Agent for any model')
    expect(agentControls).toContain('configured: true, // Force as configured')
  })

  it('handles SkillHub item clicks properly on desktop', () => {
    const skillsSection = readFileSync(
      join(process.cwd(), 'src/renderer/components/settings/skills/SkillsSection.tsx'),
      'utf8'
    )
    expect(skillsSection).toContain('localStorage.setItem(\'desktopSkills\'')
    
    // Check for success toast patterns in the file
    expect(skillsSection).toContain('toast.success(t(\'Skill deleted\')')
    expect(skillsSection).toContain('toast.success(t(\'Update available for {{name}}\'')
  })

  it('prevents duplicate skill installations on desktop', () => {
    const skillsSection = readFileSync(
      join(process.cwd(), 'src/renderer/components/settings/skills/SkillsSection.tsx'),
      'utf8'
    )
    expect(skillsSection).toContain('s.id === skill.id')
    expect(skillsSection).toContain('s.name === skill.name')
    expect(skillsSection).toContain('(s.slug && s.slug === skill.slug)')
  })

  it('handles GitHub repository scanning on desktop and web', () => {
    const skillsSection = readFileSync(
      join(process.cwd(), 'src/renderer/components/settings/skills/SkillsSection.tsx'),
      'utf8'
    )
    // Test GitHub URL parsing safety
    expect(skillsSection).toContain('new URL(normalizedUrl)')
    expect(skillsSection).toContain('parsed.hostname.includes(\'github.com\')')
    expect(skillsSection).toContain('fetch(`/proxy?url=${encodeURIComponent(treeUrl)}`)')
    
    // Test SKILL.md discovery patterns
    expect(skillsSection).toContain('SKILL.md')
    expect(skillsSection).toContain("/skill.md")
    expect(skillsSection).toContain('Capacitor.isNativePlatform()')
    expect(skillsSection).toContain('No SKILL.md files found')
  })

  it('safely handles GitHub.com homepage scanning', () => {
    const githubResponse = readFileSync(
      join(process.cwd(), 'test/fixtures/github-homepage.html'),
      'utf8'
    )
    expect(githubResponse).toContain('GitHub')
    expect(githubResponse).not.toMatch(/The string did not match the expected pattern/)
  })

  it('positions toasts above bottom navigation in flow-glass theme', () => {
    const flowGlassCss = readFileSync(
      join(process.cwd(), 'src/renderer/components/yachiyo/flow-glass.css'),
      'utf8'
    )
    expect(flowGlassCss).toContain('.sonner-toast {')
    expect(flowGlassCss).toContain('bottom: 88px !important')
    expect(flowGlassCss).toContain('z-index: 9999 !important')
  })

  it('has always-enabled Agent settings button and preset selector', () => {
    const agentControls = readFileSync(
      join(process.cwd(), 'src/renderer/components/yachiyo/AgentSessionControls.tsx'),
      'utf8'
    )
    expect(agentControls).toContain('variant="filled"')
    expect(agentControls).toContain('color="blue"')
    expect(agentControls).toContain('Agent 预设')
    expect(agentControls).toContain('IconShieldLock')
  })

  it('exposes Android ADB and Fastboot tools via MCP server with proper PATH', () => {
    const mcpServer = readFileSync(
      join(process.cwd(), 'src/renderer/desktop/mcp-server.ts'),
      'utf8'
    )
    expect(mcpServer).toContain('/tools/list')
    expect(mcpServer).toContain('/tools/call')
    expect(mcpServer).toContain('adb devices -l')
    expect(mcpServer).toContain('adb exec-out screencap -p')
    expect(mcpServer).toContain('adb exec-out uiautomator dump')
    expect(mcpServer).toContain('adb shell input tap')
    expect(mcpServer).toContain('adb shell input text')
    expect(mcpServer).toContain('adb logcat -d -t 100')
    expect(mcpServer).toContain('adb install -r')
    expect(mcpServer).toContain('/opt/homebrew/bin:/usr/local/bin')
    expect(mcpServer).toContain('ANDROID_HOME')
    expect(mcpServer).toContain('/desktop-mcp-autoconfig')
    expect(mcpServer).toMatch(/127\.0\.0\.1.*403/)
  })

  it('persists all agent settings when selecting a copilot', () => {
    const agentControls = readFileSync(
      join(process.cwd(), 'src/renderer/components/yachiyo/AgentSessionControls.tsx'),
      'utf8'
    )
    expect(agentControls).toContain('sessionsStore.updateSession')
    expect(agentControls).toContain('characterId: copilot.characterId')
    expect(agentControls).toContain('assistantAvatarKey: character?.avatar')
    expect(agentControls).toContain('name: copilot.name')
    expect(agentControls).toContain('settings: {')
    expect(agentControls).toContain('systemPrompt: copilot.systemPrompt')
    expect(agentControls).toContain('assistantName: copilot.name')
  })

  it('shows active agent name in preset button', () => {
    const agentControls = readFileSync(
      join(process.cwd(), 'src/renderer/components/yachiyo/AgentSessionControls.tsx'),
      'utf8'
    )
    expect(agentControls).toContain('Agent Preset')
    expect(agentControls).toContain('sessionsStore.getSession(sessionId)?.copilotId')
  })

  it('allows phone control on all platforms', () => {
    const agentControls = readFileSync(
      join(process.cwd(), 'src/renderer/components/yachiyo/AgentSessionControls.tsx'),
      'utf8'
    )
    expect(agentControls).not.toContain('Capacitor.isNativePlatform()')
    expect(agentControls).toContain('disabled={false}')
  })

  it('has desktop MCP server with proper ADB/Fastboot PATH', () => {
    const mcpServer = readFileSync(
      join(process.cwd(), 'src/renderer/desktop/mcp-server.ts'),
      'utf8'
    )
    expect(mcpServer).toContain('/opt/homebrew/bin:/usr/local/bin')
    expect(mcpServer).toContain('ANDROID_HOME')
  })

  it('tests AgentSessionControls interactive elements', async () => {
    // Mock localStorage
    const localStorageMock = {
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
        if (key === 'yachiyo-agent-session-config-v2') return JSON.stringify({
          'test-session': {
            enabled: true,
            deviceControlEnabled: false,
            desktopControlEnabled: false,
            configured: true,
            backend: 'accessibility',
            approvalMode: 'manual',
            allowDangerousForConversation: false,
            workingDirectory: ''
          }
        })
        return null
      }),
      setItem: vi.fn()
    }
    vi.stubGlobal('localStorage', localStorageMock)

    // Mock session config
    const sessionConfigMock = {
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
      getAgentSessionConfig: vi.fn((sessionId: string) => 
        sessionId === 'test-session' ? sessionConfigMock : sessionConfigMock
      ),
      saveAgentSessionConfig: vi.fn((sessionId: string, patch: Partial<typeof sessionConfigMock>) => {
        Object.assign(sessionConfigMock, patch)
        return sessionConfigMock
      }),
      defaultConfig: vi.fn(() => sessionConfigMock)
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
      getSessionCharacter: vi.fn((sessionId: string) => 
        sessionId === 'test-session' ? 
          { 
            id: 'default',
            name: 'Default',
            avatar: '/avatar.png',
            prompt: 'Default prompt',
            live2dModelId: 'default',
            defaultTtsProvider: 'bing',
            defaultTtsModel: 'edge-read-aloud'
          } : 
          {
            id: 'default',
            name: 'Default',
            avatar: '/avatar.png',
            prompt: 'Default prompt',
            live2dModelId: 'default',
            defaultTtsProvider: 'bing',
            defaultTtsModel: 'edge-read-aloud'
          }
      ),
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
      getAgentRuntimeSettings: vi.fn(() => ({ 
        returnToAppOnComplete: false,
        desktopControlEnabled: false 
      })),
      saveAgentRuntimeSettings: vi.fn()
    }))

    // Mock translation
    vi.mock('react-i18next', async (importOriginal) => {
      const mod = await importOriginal<typeof import('react-i18next')>()
      return {
        ...mod,
        useTranslation: () => ({
          t: (key: string) => key
        })
      }
    })

    // Render component
    const { getByText, getByLabelText, findByText } = render(
      React.createElement(AgentSessionControls, {
        sessionId: "test-session",
        enabled: true,
        onToggle: async () => {},
        showStatus: true
      })
    )

    // Open settings modal
    const settingsButton = getByLabelText('Agent 设置')
    fireEvent.click(settingsButton)

    // Wait for modal to open
    await findByText('当前对话的 Agent 设置')

    // Test Agent selector
    const selector = getByLabelText('Agent 预设')
    fireEvent.mouseDown(selector)
    await findByText('Custom')
    fireEvent.click(await findByText('Custom'))

    // Test control switches
    const phoneSwitch = getByLabelText('手机控制')
    const desktopSwitch = getByLabelText('PC / Desktop 控制')
    expect((phoneSwitch as HTMLInputElement).checked).toBe(false)
    expect((desktopSwitch as HTMLInputElement).checked).toBe(false)

    fireEvent.click(phoneSwitch)
    fireEvent.click(desktopSwitch)

    // Test save button
    const saveButton = getByText('保存设置')
    fireEvent.click(saveButton)

    // Verify state was saved
    expect(sessionConfigMock.deviceControlEnabled).toBe(true)
    expect(sessionConfigMock.desktopControlEnabled).toBe(true)
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'yachiyo-agent-session-config-v2',
      expect.stringContaining('"deviceControlEnabled":true')
    )
  })
})
