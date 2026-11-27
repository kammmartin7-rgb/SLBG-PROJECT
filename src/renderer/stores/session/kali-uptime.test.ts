import { describe, expect, it } from 'vitest'
import { formatKaliUptime, uptimeLanguage } from './kali-uptime'

describe('direct Kali uptime replies', () => {
  it('recognizes the reported prompt and a Hebrew equivalent', () => {
    expect(uptimeLanguage('Use Kali VM Status to check how long my Kali machine has been running. Report the uptime returned by the tool.')).toBe('en')
    expect(uptimeLanguage('כמה זמן קאלי רצה?')).toBe('he')
    expect(uptimeLanguage('Check Kali uptime and then check disk space')).toBeUndefined()
  })
  it('formats the returned seconds from structured and text MCP results', () => {
    expect(formatKaliUptime({ structuredContent: { uptime_seconds: 3723 } }, 'en')).toBe('Kali uptime: 1h 2m 3s.')
    expect(formatKaliUptime({ content: [{ type: 'text', text: '{"uptime_seconds":0}' }] }, 'he')).toContain('0 שעות')
  })
  it('reports a denial, connection error or absent measurement as received', () => {
    expect(formatKaliUptime({ error: 'user_denied_mcp_tool' }, 'en')).toContain('not approved')
    expect(formatKaliUptime({ isError: true, content: [{ type: 'text', text: 'Connection refused' }] }, 'en')).toContain('Connection refused')
    expect(formatKaliUptime({ structuredContent: { uptime_seconds: -1 } }, 'en')).toContain('did not return')
  })
})
