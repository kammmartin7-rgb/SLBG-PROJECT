// Only route standalone uptime requests. Compound tasks still use the normal chat flow.
export function uptimeLanguage(text: string): 'he' | 'en' | undefined {
  const prompt = text.trim().replace(/[?.!]+$/, '').replace(/\s+/g, ' ')
  if (/^(?:use kali vm status to check how long my kali machine has been running(?:\. report the uptime returned by the tool)?|(?:what is (?:my |the )?|check |show )?kali(?: vm)? uptime|how long has (?:my |the )?kali(?: vm| machine)? been running)$/i.test(prompt)) return 'en'
  if (/^(?:כמה זמן (?:מכונת )?(?:קאלי|קלי|kali)(?: שלי)? (?:פועלת|פעילה|עובדת|רץ|רצה|דלוקה)|(?:בדוק |הצג )?(?:את )?זמן הפעילות של (?:קאלי|קלי|kali))$/i.test(prompt)) return 'he'
}

export function formatKaliUptime(output: unknown, language: 'en' | 'he'): string {
  const hebrew = language === 'he'
  const unavailable = hebrew ? 'הכלי לא החזיר זמן פעילות של Kali.' : 'The Kali tool did not return an uptime.'
  if (!output || typeof output !== 'object') return unavailable
  const result = output as { error?: unknown; isError?: boolean; structuredContent?: unknown; content?: {type: string; text?: string}[] }
  if (result.error === 'user_denied_mcp_tool') return hebrew ? 'הבקשה להפעלת כלי הסטטוס לא אושרה.' : 'The request to run the Kali status tool was not approved.'
  const text = Array.isArray(result.content) ? result.content.find(part => part?.type === 'text')?.text : undefined
  if (result.isError || result.error || output instanceof Error) {
    const detail = output instanceof Error ? output.message : String(result.error || text || '')
    return [unavailable, detail.slice(0, 400)].filter(Boolean).join(' ')
  }
  let data = result.structuredContent ?? output
  if (text && !('uptime_seconds' in Object(data))) {
    try { data = JSON.parse(text) } catch { return unavailable }
  }
  const seconds = (data as {uptime_seconds?: number} | null)?.uptime_seconds
  if (typeof seconds !== 'number' || !Number.isSafeInteger(seconds) || seconds < 0) return unavailable
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds / 60) % 60
  return hebrew ? `זמן הפעילות של Kali הוא ${hours} שעות, ${minutes} דקות ו־${seconds % 60} שניות.`
    : `Kali uptime: ${hours}h ${minutes}m ${seconds % 60}s.`
}
