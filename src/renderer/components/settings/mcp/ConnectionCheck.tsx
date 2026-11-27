import { Button, NativeSelect, Stack, Text, Textarea } from '@mantine/core'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { useEffect, useRef, useState } from 'react'
import { createSafeMcpOAuthFetch } from '@/mobile/mcp-oauth-provider'
import { desktopTransport, desktopCommandIssue } from '@/packages/mcp/desktop-transport'
import type { MCPServerConfig } from '@/packages/mcp/types'

export function ConnectionCheck({ config }: { config: MCPServerConfig }) {
  const { transport } = config
  const issue = desktopCommandIssue(transport)
  const client = useRef<Client>()
  const generation = useRef(0)
  const [busy, setBusy] = useState(false)
  const [auth, setAuth] = useState('')
  const [discovery, setDiscovery] = useState('')
  const [result, setResult] = useState('')
  const [tools, setTools] = useState<string[]>([])
  const [selected, select] = useState('')
  const [args, setArgs] = useState('{}')
  useEffect(() => () => {
    generation.current++
    void client.current?.close().catch(() => {})
  }, [])
  async function test() {
    const attempt = ++generation.current
    setBusy(true)
    setAuth('Skipped')
    setDiscovery('Skipped')
    setResult('Skipped')
    setTools([])
    let stage = 'connect'
    try {
      await client.current?.close()
      const next = new Client({ name: 'yachiyo-connection-check', version: '1' })
      client.current = next
      const builtin = desktopTransport(transport)
      let connection: Transport
      if (builtin) connection = builtin as Transport
      else {
        if (transport.type !== 'http') throw Error('Unsupported local command')
        if (transport.secretRefs?.length || transport.oauth?.enabled) throw Error('Credential provider required')
        const options = { fetch: createSafeMcpOAuthFetch(), requestInit: { headers: transport.headers } }
        connection = transport.protocol === 'sse' ? new SSEClientTransport(new URL(transport.url), options)
          : new StreamableHTTPClientTransport(new URL(transport.url), options)
      }
      await next.connect(connection, { timeout: 15000 })
      if (generation.current !== attempt) return
      setAuth(transport.type === 'http' && (transport.oauth?.enabled || Object.keys(transport.headers || {}).length)
        ? 'Connection accepted; principal unverified' : 'No credentials configured')
      stage = 'discovery'
      const names: string[] = []
      let count = 0
      const cursors = new Set<string>()
      let cursor: string | undefined
      do {
        const page = await next.listTools({ cursor }, { timeout: 15000 })
        count += page.tools.length
        names.push(...page.tools.filter(tool => tool.annotations?.readOnlyHint === true).map(tool => tool.name))
        cursor = page.nextCursor
        if (cursor && cursors.has(cursor)) throw Error('Repeated tools page')
        if (cursor) cursors.add(cursor)
      } while (cursor)
      if (generation.current !== attempt) return
      setDiscovery(String(count) + ' discovered')
      setTools(names)
      select(names[0] || '')
      setArgs(transport.type === 'stdio' && transport.command === 'yachiyo-math' ? '{"a":84,"b":30}' : '{}')
      setResult(names.length ? 'Select a tool and run it' : 'Skipped: no tool marked read-only')
    } catch (error) {
      if (generation.current !== attempt) return
      const detail = error instanceof Error ? error.message : 'Connection failed'
      if (stage === 'connect') setAuth('Unverified: ' + detail)
      else setDiscovery('Failed: ' + detail)
      await client.current?.close().catch(() => {})
    } finally {
      if (generation.current === attempt) setBusy(false)
    }
  }
  async function run() {
    if (!tools.includes(selected) || !client.current) return
    setBusy(true)
    try {
      const input = JSON.parse(args)
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Enter a JSON object')
      const reply = await client.current.callTool({ name: selected, arguments: input }, undefined, { timeout: 15000 })
      setResult((reply.isError ? 'Tool error: ' : 'Returned: ') + JSON.stringify(reply.content ?? reply.structuredContent).slice(0, 1000))
    } catch (error) {
      setResult('Failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setBusy(false)
    }
  }
  return <Stack gap="xs" mt="xs">
    {issue && <Text size="xs" c="red">{issue}</Text>}
    <Button variant="light" size="xs" disabled={!!issue || busy} onClick={test}>Test connection</Button>
    {(auth || issue) && <>
      <Text size="xs">Configuration: loaded</Text>
      <Text size="xs">Authentication: {auth || 'Skipped'}</Text>
      <Text size="xs">Tools: {discovery || 'Skipped'}</Text>
      <Text size="xs">Read-only call: {result || 'Skipped'}</Text>
    </>}
    {tools.length > 0 && <>
      <NativeSelect label="Read-only tool" data={tools} value={selected} disabled={busy} onChange={e => { select(e.currentTarget.value); setArgs('{}'); setResult('Ready') }} />
      <Textarea label="Arguments (JSON)" value={args} onChange={e => setArgs(e.currentTarget.value)} />
      <Button size="xs" disabled={busy} onClick={run}>Run selected tool</Button>
    </>}
  </Stack>
}
