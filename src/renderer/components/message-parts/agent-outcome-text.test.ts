import { expect, it } from 'vitest'
import { agentOutcomeText } from '@shared/utils/agent-outcome-text'

it('reads stored JSON summaries and preserves the requested next action', () => {
  const part = { toolName: 'agent_blocked', state: 'result', result: '{"summary":"Connect phone"}', args: { user_action: 'Unlock it' } }
  expect(agentOutcomeText(part)).toBe('Connect phone\n\nUnlock it')
  expect(agentOutcomeText({ ...part, result: 'invalid' })).toBe('Unlock it')
  expect(agentOutcomeText({ ...part, state: 'call' })).toBe('')
})
