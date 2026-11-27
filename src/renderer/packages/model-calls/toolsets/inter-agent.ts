import { agentOutcomeText } from '@shared/utils/agent-outcome-text'
import { createMessage, type Message } from '@shared/types'
import { tool } from 'ai'
import { z } from 'zod'

// The task runner shares its approval and cancellation state. Serialize delegated
// task runs through that runner. Ordinary chats have independent generations.
const delivery = new Map<string, 'queued' | 'running'>()
const failures = new Map<string, string>()
let taskQueue = Promise.resolve()

async function runTask(id: string, message: Message) {
  const { isTaskGenerating, submitTaskMessage } = await import('@/stores/taskSessionActions')
  while (isTaskGenerating()) await new Promise(resolve => setTimeout(resolve, 300))
  delivery.set(id, 'running')
  await submitTaskMessage(id, message)
}

export function interAgentTools(caller: string, linkedChat?: string) {
  return {
    list_sessions: tool({
      description: 'List other local chat and agent sessions that can receive a task.',
      inputSchema: z.object({}),
      execute: async () => {
        const { listAllTaskSessions } = await import('@/stores/taskSessionStore')
        const chatStore = await import('@/stores/chatStore')
        const [tasks, chats] = await Promise.all([listAllTaskSessions(), chatStore.listAllSessionsMeta()])
        const linked = new Set(tasks.map(t => t.linkedSessionId))
        return [
          ...tasks.filter(t => t.id !== caller && t.linkedSessionId !== caller)
            .map(t => ({ id: t.id, name: t.name, type: 'agent' })),
          ...chats.filter(c => !linked.has(c.id) && c.id !== caller && c.id !== linkedChat && (!c.type || c.type === 'chat'))
            .map(c => ({ id: c.id, name: c.name, type: 'chat' })),
        ]
      },
    }),
    send_to_session: tool({
      description: 'Queue a message for another local session. A task agent starts after the active task finishes. Report the queue receipt and finish your turn so the target can run.',
      inputSchema: z.object({ sessionId: z.string().min(1), text: z.string().trim().min(1).max(8000) }),
      execute: async ({ sessionId, text }) => {
        const { getTaskSession } = await import('@/stores/taskSessionStore')
        const chatStore = await import('@/stores/chatStore')
        const { submitNewUserMessage } = await import('@/stores/session/messages')
        const task = await getTaskSession(sessionId)
        if (sessionId === caller || sessionId === linkedChat || task?.linkedSessionId === caller) return { error: 'self_send' }
        const chat = task ? null : await chatStore.getSession(sessionId)
        if (!task && (!chat || (chat.type && chat.type !== 'chat'))) return { error: 'unknown_session' }
        if (delivery.has(sessionId) || (task || chat)?.messages.some(m => m.generating)) return { error: 'target_busy' }
        failures.delete(sessionId)
        delivery.set(sessionId, task ? 'queued' : 'running')
        const message = createMessage('user', text)
        const job = task ? taskQueue.then(() => runTask(sessionId, message))
          : submitNewUserMessage(sessionId, { newUserMsg: message, needGenerating: true })
        const settled = job.catch((error: Error) => { failures.set(sessionId, error.message) })
          .finally(() => delivery.delete(sessionId))
        if (task) taskQueue = settled
        return { queued: true, sessionId, messageId: message.id }
      },
    }),
    get_session_status: tool({
      description: 'Read a local agent or chat session’s queue state and most recent answer.',
      inputSchema: z.object({ sessionId: z.string().min(1) }),
      execute: async ({ sessionId }) => {
        const { getTaskSession } = await import('@/stores/taskSessionStore')
        const chatStore = await import('@/stores/chatStore')
        const session = await getTaskSession(sessionId) || await chatStore.getSession(sessionId)
        if (!session) return { error: 'unknown_session' }
        const last = [...session.messages].reverse().find(m => m.role === 'assistant')
        const text = last?.contentParts.flatMap(p => {
          if (p.type === 'text') return [p.text]
          if (p.type === 'tool-call' && p.state === 'result' && ['agent_complete','agent_blocked'].includes(p.toolName)) {
            const summary = agentOutcomeText(p)
            if (summary) return [summary]
          }
          return []
        }).join('\n')
        return { state: delivery.get(sessionId) ?? (last?.generating ? 'running' : 'idle'),
          error: failures.get(sessionId) ?? last?.error, messageId: last?.id, reply: text?.slice(-4000) }
      },
    }),
  }
}
