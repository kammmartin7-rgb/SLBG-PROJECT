import { Text } from '@mantine/core'

import { agentOutcomeText } from '@shared/utils/agent-outcome-text'

export function AgentOutcome({ part }: { part: { toolName: string; state: string; result?: unknown; args: unknown } }) {
  const text = agentOutcomeText(part)
  return text ? <Text style={{ whiteSpace: 'pre-wrap', userSelect: 'text' }}>{text}</Text> : null
}
