function fields(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return {}
    }
  }
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

export function agentOutcomeText(part: { toolName: string; state: string; result?: unknown; args: unknown }) {
  if (part.state !== 'result' || !['agent_complete', 'agent_blocked'].includes(part.toolName)) return ''
  const result = fields(part.result)
  const args = fields(part.args)
  const firstText = (...values: unknown[]) => values.find((value): value is string => typeof value === 'string' && !!value.trim())
  return [firstText(result.summary, args.summary), firstText(result.nextHint, args.user_action)].filter(Boolean).join('\n\n')
}
