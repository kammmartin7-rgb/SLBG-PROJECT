import { beforeEach, describe, expect, it, vi } from 'vitest'
import { interAgentTools } from './inter-agent'
import { submitNewUserMessage } from '../../../stores/session/messages'

vi.mock('../../../stores/chatStore', () => ({
  listAllSessionsMeta: async () => [{ id: 'mirror' }, { id: 'peer' }],
  getSession: async () => ({ messages: [{ id: 'reply', role: 'assistant', contentParts: [{ type: 'text', text: 'Ready.' }] }] }),
}))
vi.mock('../../../stores/taskSessionStore', () => ({
  listAllTaskSessions: async () => [{id:'task',linkedSessionId:'mirror',name:'Caller'}],
  getTaskSession: async () => null,
}))
vi.mock('../../../stores/session/messages', () => ({submitNewUserMessage: vi.fn(async () => {})}))

describe('inter-agent delivery', () => {
  const tools = interAgentTools('task','mirror')
  const context = { toolCallId:'test', messages:[] }
  beforeEach(() => vi.clearAllMocks())
  it('discovers peers and excludes the linked chat of the calling task', async () => {
    expect(await tools.list_sessions.execute!({}, context)).toEqual([{id:'peer', type:'chat'}])
    expect(await tools.send_to_session.execute!({sessionId:'mirror', text:'hello'},context)).toEqual({error:'self_send'})
  })
  it('starts a real target generation through the normal message entry point and reads its status', async () => {
    expect(await tools.send_to_session.execute!({sessionId:'peer', text:'hello'},context)).toMatchObject({queued:true})
    expect(submitNewUserMessage).toHaveBeenCalledWith('peer',expect.objectContaining({needGenerating:true}))
    expect(await tools.get_session_status.execute!({sessionId:'peer'},context)).toMatchObject({reply:'Ready.'})
  })
})
