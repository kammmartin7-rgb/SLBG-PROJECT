// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { AgentSessionControls } from '../components/yachiyo/AgentSessionControls'
import { initReactI18next } from 'react-i18next'
import i18n from 'i18next'

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual('react-i18next')
  return {
    ...actual as typeof import('react-i18next'),
    useTranslation: () => ({ t: (key: string) => key })
  }
})

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: {} } }
})

describe('AgentSessionControls', () => {
  it('renders with agent selector and control toggles', async () => {
    render(
      <MantineProvider>
        <AgentSessionControls 
          sessionId="test-session" 
          enabled={false} 
          onToggle={async () => {}} 
        />
      </MantineProvider>
    )

    // Verify agent selector exists
    expect(screen.getByLabelText('Agent 预设')).toBeInTheDocument()
    
    // Verify control toggles exist
    expect(screen.getByLabelText('PC / Desktop 控制')).toBeInTheDocument()
    expect(screen.getByLabelText('手机控制')).toBeInTheDocument()
  })
})
