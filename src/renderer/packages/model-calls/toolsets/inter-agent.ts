import { tool } from 'ai'
import { z } from 'zod'
import { createMessage, MessageRoleEnum } from '@shared/types'
import * as chatStore from '@/stores/chatStore'
import { insertMessage } from '@/stores/session/messages'

const activeTargets = new Set<string>()

function ok(extra: Record<string, unknown> = {}) {
  return { success: true, ...extra }
}

function fail(code: string, detail?: string) {
  return { success: false, error: code, detail: detail || null }
}

export function createInterAgentToolSet(callerSessionId?: string) {
  return {
    description: 'Inter-agent platform tools. Use list_sessions to discover other sessions, send_to_session to deliver a message and start the target agent, and get_session_status to read recent results. Do not send to yourself.',
    tools: {
      list_sessions: tool({
        description: 'List other sessions on this platform (id, name, type). Excludes the calling session.',
        inputSchema: z.object({ limit: z.number().int().min(1).max(50).optional() }),
        execute: async ({ limit }) => {
          const all = await chatStore.listSessionsMeta()
          const sessions = all.filter((s) => s.id !== callerSessionId).slice(0, limit ?? 30).map((s) => ({ id: s.id, name: s.name || '(unnamed)', type: s.type || 'chat' }))
          return ok({ sessions, count: sessions.length })
        },
      }),
      send_to_session: tool({
        description: 'Send a text message to another session and start its generation.',
        inputSchema: z.object({
          sessionId: z.string().min(1),
          text: z.string().min(1).max(8000),
          startGeneration: z.boolean().optional(),
        }),
        execute: async ({ sessionId, text, startGeneration }) => {
          if (sessionId === callerSessionId) return fail('self_send_forbidden')
          if (activeTargets.has(sessionId)) return fail('target_busy')
          const target = await chatStore.getSession(sessionId)
          if (!target) return fail('session_not_found')
          const userMsg = createMessage(MessageRoleEnum.User, text)
          await insertMessage(sessionId, userMsg)
          const shouldStart = startGeneration !== false
          if (shouldStart) {
            activeTargets.add(sessionId)
            try {
              const { generate } = await import('@/stores/session/generation')
              const assistantMsg = createMessage(MessageRoleEnum.Assistant, '')
              assistantMsg.generating = true
              await insertMessage(sessionId, assistantMsg)
              void generate(sessionId, assistantMsg, { operationType: 'send_message' }).finally(() => activeTargets.delete(sessionId))
            } catch (err) {
              activeTargets.delete(sessionId)
              return fail('generation_start_failed', err instanceof Error ? err.message : String(err))
            }
          }
          return ok({ delivered: true, messageId: userMsg.id, started: shouldStart, targetSessionId: sessionId })
        },
      }),
      get_session_status: tool({
        description: 'Read the recent messages and generating flag of another session.',
        inputSchema: z.object({ sessionId: z.string().min(1), limit: z.number().int().min(1).max(20).optional() }),
        execute: async ({ sessionId, limit }) => {
          const session = await chatStore.getSession(sessionId)
          if (!session) return fail('session_not_found')
          const messages = (session.messages || []).slice(-(limit ?? 5)).map((m) => ({
            id: m.id,
            role: m.role,
            text: (m.contentParts || []).filter((p) => p.type === 'text').map((p) => (p as { text?: string }).text || '').join('\n').slice(0, 500),
            generating: Boolean((m as { generating?: boolean }).generating),
          }))
          return ok({ sessionId, name: session.name || '(unnamed)', generating: messages.some((m) => m.generating) || activeTargets.has(sessionId), recent: messages })
        },
      }),
    },
  }
}
