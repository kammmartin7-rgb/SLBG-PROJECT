import type { Settings } from '@shared/types'

export function mergeSettingsConnections(current: Settings | null, imported: Settings): Settings {
  if (!current) return imported
  const providers = { ...current.providers }
  for (const [id, provider] of Object.entries(imported.providers ?? {})) {
    providers[id] = { ...providers[id], ...provider }
  }
  const servers = new Map(current.mcp?.servers.map(server => [server.id, server]))
  for (const server of imported.mcp?.servers ?? []) {
    if (!servers.has(server.id)) servers.set(server.id, server)
  }
  const enabledBuiltinServers = new Set([
    ...(current.mcp?.enabledBuiltinServers ?? []),
    ...(imported.mcp?.enabledBuiltinServers ?? []),
  ])
  return {
    ...current,
    ...imported,
    providers,
    mcp: {
      ...current.mcp,
      ...imported.mcp,
      enabledBuiltinServers: [...enabledBuiltinServers],
      servers: [...servers.values()],
    },
  }
}
