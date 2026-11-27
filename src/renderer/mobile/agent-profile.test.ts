import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAgentIdentityPrompt, getAgentProfileState, saveAgentProfileState } from './agent-profile'

describe('Android Agent profiles', () => {
  const values = new Map<string, string>()

  beforeEach(() => {
    values.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    })
  })

  it('ships the Yachiyo soul as the only built-in profile', () => {
    const state = getAgentProfileState()
    expect(state.profiles).toHaveLength(1)
    expect(state.profiles[0].soul).toContain('你不是机器人。你是月见八千代。')
  })

  it('combines Agent Soul with migrated shared User and Memory context', () => {
    const state = getAgentProfileState()
    state.profiles[0] = { ...state.profiles[0], user: '称呼用户为 Wayne', memory: '偏好本地优先' }
    saveAgentProfileState(state)
    const prompt = buildAgentIdentityPrompt()
    expect(prompt).toContain('<agent_soul>')
    expect(prompt).toContain('<user_profile>')
    expect(prompt).toContain('<memory>')
  })
})

it('imports a browser profile copy twice without changing the source or replacing desktop agents', async () => {
  const { mergeImportedAgentProfiles } = await import('./agent-profile')
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  })
  const source = { activeProfileId: 'browser', profiles: [{ id: 'browser', name: 'Browser agent', soul: 'Browser instructions' }] }
  const builtin = getAgentProfileState().profiles[0]
  source.profiles.push({ id: builtin.id, name: 'Customized built-in', soul: 'Keep the imported customization' })
  const copy = JSON.parse(JSON.stringify(source))
  expect(mergeImportedAgentProfiles(copy).activeProfileId).toBe('browser')
  expect(mergeImportedAgentProfiles(copy).profiles.find(p => p.id === builtin.id)?.name).toBe('Customized built-in')
  saveAgentProfileState({ activeProfileId: 'desktop', profiles: [{ id: 'desktop', name: 'Desktop agent', soul: 'Keep me' }] })
  saveAgentProfileState(mergeImportedAgentProfiles(copy))
  const first = getAgentProfileState()
  saveAgentProfileState(mergeImportedAgentProfiles(copy))
  expect(getAgentProfileState()).toEqual(first)
  expect(first.activeProfileId).toBe('desktop')
  expect(first.profiles.find(p => p.id === builtin.id)?.name).toBe(builtin.name)
  expect(first.profiles.map(p => p.id)).toEqual(expect.arrayContaining(['desktop', 'browser']))
  expect(copy).toEqual(source)
})

it('restricts profile bindings to globally enabled skills, including an empty selection', async () => {
  const { skillsForAgent } = await import('./agent-profile')
  const profile = { id: 'a', name: 'A', soul: '' }
  expect(skillsForAgent(['one'], profile)).toEqual(['one'])
  expect(skillsForAgent(['one'], { ...profile, skillNames: [] })).toEqual([])
  expect(skillsForAgent(['one'], { ...profile, skillNames: ['one', 'disabled'] })).toEqual(['one'])
})
