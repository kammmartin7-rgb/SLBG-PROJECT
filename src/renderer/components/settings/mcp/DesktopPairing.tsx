import { Button, PasswordInput, Stack, Text, TextInput } from '@mantine/core'
import { Capacitor } from '@capacitor/core'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { useState } from 'react'
import { getActiveAgentProfile } from '@/mobile/agent-profile'
import { mobileMcpController } from '@/mobile/mcp-mobile-controller'
import { createSafeMcpOAuthFetch } from '@/mobile/mcp-oauth-provider'
import { mcpController } from '@/packages/mcp/controller'
import type { MCPServerConfig } from '@/packages/mcp/types'
import { useSettingsStore } from '@/stores/settingsStore'

type Pair = { secret: string; port: number }
type Bridge = { setupMath(): Promise<void>; pair(profile: string | null): Promise<Pair | undefined> }

export function DesktopPairing() {
  const desktop = (globalThis as typeof globalThis & { yachiyoDesktop?: Bridge }).yachiyoDesktop
  const mobile = Capacitor.getPlatform() === 'android'
  const [pair, setPair] = useState<Pair>()
  const [endpoint, setEndpoint] = useState('')
  const [secret, setSecret] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const setSettings = useSettingsStore(state => state.setSettings)
  if (!desktop && !mobile) return null
  async function run(action: () => Promise<void>) {
    setBusy(true)
    setStatus('')
    try { await action() } catch (error) { setStatus(error instanceof Error ? error.message : 'Connection failed') }
    finally { setBusy(false) }
  }
  async function connect() {
    const url = new URL(endpoint.trim())
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.ts.net') || url.username || url.password ||
      url.pathname !== '/mcp' || url.search || url.hash) throw Error('Enter your HTTPS Tailscale Serve URL ending in /mcp.')
    const profile = getActiveAgentProfile().id
    const client = new Client({ name: 'Hacker Tool', version: '1' })
    try {
      await client.connect(new StreamableHTTPClientTransport(url, { fetch: createSafeMcpOAuthFetch(),
        requestInit: { headers: { Authorization: 'Bearer ' + secret.trim() } } }), { timeout: 15000 })
      const result = await client.callTool({ name: 'agent_identity', arguments: {} })
      if (result.isError || !Array.isArray(result.content) || result.content[0]?.text !== profile ||
        getActiveAgentProfile().id !== profile) throw Error('Desktop did not verify the current agent profile.')
      if (mobile) {
        const ref = { id: crypto.randomUUID(), kind: 'oauth-access-token' as const }
        const config: MCPServerConfig = { id: 'paired-agent:' + profile, name: 'Paired Desktop', enabled: true,
          transport: { type: 'http', protocol: 'streamable-http', url: url.href, secretRefs: [ref] } }
        await mobileMcpController.saveSecret(ref, secret.trim())
        setSettings(draft => { draft.mcp.servers = [...draft.mcp.servers.filter(s => s.id !== config.id), config] })
        await mcpController.updateServer(config)
        if (mcpController.getServer(config.id)?.status.state !== 'running') throw Error('Identity verified. Desktop tool discovery failed.')
      }
      setStatus('Desktop verified agent ' + profile + (mobile ? '. Paired desktop tools are available in chat.' : '.'))
      setSecret('')
    } finally { await client.close().catch(() => {}) }
  }
  return <Stack gap="xs">
    {desktop?.setupMath && <Button variant="light" disabled={busy} onClick={() => run(async () => { await desktop.setupMath(); setStatus('SymPy, NetworkX and Z3 are ready. Reconnect Offline Math.') })}>Install desktop math libraries</Button>}
    <Text fw={600}>Pair with a Yachiyo desktop</Text>
    {desktop?.pair && <>
      <Button disabled={busy} onClick={() => run(async () => { const profile = getActiveAgentProfile().id; setPair(await desktop.pair(profile)); setStatus('Local MCP verified agent ' + profile + '. Invalid secret rejected.') })}>Create pairing secret for current agent</Button>
      <Button variant="light" disabled={busy} onClick={() => run(async () => { await desktop.pair(null); setPair(undefined); setStatus('Pairing stopped') })}>Stop desktop pairing</Button>
      {pair && <>
        <PasswordInput label="Shared secret" value={pair.secret} readOnly />
        <Text size="sm">Keep the desktop open. Start this tailnet-only proxy on the Mac, then enter its HTTPS address followed by /mcp on your phone.</Text>
        <code>{'tailscale serve --https=8443 http://127.0.0.1:' + pair.port}</code>
      </>}
    </>}
    <TextInput label="Paired desktop HTTPS URL" value={endpoint} onChange={e => setEndpoint(e.currentTarget.value)} />
    <PasswordInput label="Desktop pairing secret" value={secret} onChange={e => setSecret(e.currentTarget.value)} />
    <Button disabled={busy || !endpoint || !secret} onClick={() => run(connect)}>{mobile ? 'Verify agent and pair' : 'Verify remote agent identity'}</Button>
    {status && <Text size="sm">{status}</Text>}
  </Stack>
}
