import { LEGACY_YACHIYO_SOUL, YACHIYO_PERSONA_ID, YACHIYO_PERSONA_NAME, YACHIYO_SOUL } from '@shared/personas/yachiyo'
import { z } from 'zod'
import { buildSharedUserContextPrompt } from './shared-user-context'

const AGENT_PROFILE_KEY = 'yachiyo-agent-profiles-v1'

export interface AgentProfile {
  id: string
  name: string
  soul: string
  skillNames?: string[]
  /** @deprecated Migrated to shared-user-context and retained for stored-profile compatibility. */
  user?: string
  /** @deprecated Migrated to shared-user-context and retained for stored-profile compatibility. */
  memory?: string
  builtin?: boolean
}

export interface AgentProfileState {
  activeProfileId: string
  profiles: AgentProfile[]
}

const builtinProfile = (): AgentProfile => ({
  id: YACHIYO_PERSONA_ID,
  name: YACHIYO_PERSONA_NAME,
  soul: YACHIYO_SOUL,
  builtin: true,
})

function initialState(): AgentProfileState {
  return { activeProfileId: YACHIYO_PERSONA_ID, profiles: [builtinProfile()] }
}

export function getAgentProfileState(): AgentProfileState {
  if (typeof localStorage === 'undefined') return initialState()
  try {
    const parsed = JSON.parse(localStorage.getItem(AGENT_PROFILE_KEY) || '') as AgentProfileState
    if (!parsed.profiles?.length) return initialState()
    const profiles = parsed.profiles.some((profile) => profile.id === YACHIYO_PERSONA_ID)
      ? parsed.profiles
      : [builtinProfile(), ...parsed.profiles]
    const activeProfileId = profiles.some((profile) => profile.id === parsed.activeProfileId)
      ? parsed.activeProfileId
      : YACHIYO_PERSONA_ID
    return { activeProfileId, profiles }
  } catch {
    return initialState()
  }
}

export function saveAgentProfileState(state: AgentProfileState): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(AGENT_PROFILE_KEY, JSON.stringify(state))
}

// Imported profiles are additive. A second import preserves local edits and selection.
export function mergeImportedAgentProfiles(value: unknown): AgentProfileState {
  const imported = z.object({
    activeProfileId: z.string(),
    profiles: z.array(z.object({
      id: z.string().min(1), name: z.string(), soul: z.string(), skillNames: z.array(z.string()).optional(),
      user: z.string().optional(), memory: z.string().optional(), builtin: z.boolean().optional(),
    })),
  }).parse(value)
  const current = getAgentProfileState()
  const fresh = localStorage.getItem(AGENT_PROFILE_KEY) === null
  const profiles = new Map(current.profiles.map(profile => [profile.id, profile]))
  for (const profile of imported.profiles) {
    if (fresh || !profiles.has(profile.id)) profiles.set(profile.id, profile)
  }
  const useImportedSelection = fresh && profiles.has(imported.activeProfileId)
  return { activeProfileId: useImportedSelection ? imported.activeProfileId : current.activeProfileId, profiles: [...profiles.values()] }
}

export function getActiveAgentProfile(): AgentProfile {
  const state = getAgentProfileState()
  return state.profiles.find((profile) => profile.id === state.activeProfileId) || state.profiles[0]
}

export function skillsForAgent(enabled: string[], profile = getActiveAgentProfile()) {
  return enabled.filter(name => profile.skillNames === undefined || profile.skillNames.includes(name))
}

export function buildAgentIdentityPrompt(profile = getActiveAgentProfile()): string {
  return [
    '<agent_soul>',
    profile.soul === LEGACY_YACHIYO_SOUL ? YACHIYO_SOUL : profile.soul.trim(),
    '</agent_soul>',
    buildSharedUserContextPrompt(),
  ]
    .filter(Boolean)
    .join('\n\n')
}
