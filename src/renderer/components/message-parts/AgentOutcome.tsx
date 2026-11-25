import { Text } from '@mantine/core'

export function AgentOutcome({ part }: { part: { toolName: string; state: string; result?: unknown; args: unknown } }) {
  if (part.state !== 'result' || !['agent_complete', 'agent_blocked'].includes(part.toolName)) return null
  const result = part.result as { summary?: unknown; nextHint?: unknown } | null
  const args = part.args as { summary?: unknown; user_action?: unknown } | null
  const summary = result?.summary ?? args?.summary
  const next = result?.nextHint ?? args?.user_action
  return <Text style={{ whiteSpace: 'pre-wrap', userSelect: 'text' }}>
    {[summary, next].filter((value) => typeof value === 'string' && value).join('\n\n')}
  </Text>
}
