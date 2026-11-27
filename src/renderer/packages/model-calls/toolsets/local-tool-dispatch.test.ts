import { WorkspaceAgentPlanSchema } from '@shared/agent/workspace'
import type { ToolSet } from 'ai'
import { expect, it, vi } from 'vitest'
import { CodingProjectRecordSchema } from '@shared/types'
import { createCodingToolSet } from './coding'
import { createWorkspaceAgentToolSet } from './workspace-agent'
import workspaceBrowser from './workspace-browser'
import sandbox from './sandbox'
import files from './file'
import { getToolSet as knowledgeBase } from './knowledge-base'
import { getToolSet as attachments } from './session-attachment-rag'
import { createLongTermMemoryToolSet } from './long-term-memory'

const { api, marker } = vi.hoisted(() => {
  const marker = 'fixture'
  const ok = () => vi.fn(async () => ({ success: true, content: marker, stdout: marker, exitCode: 0 }))
  const api = {
    controlledBrowserNavigate: ok(), controlledBrowserClick: ok(), controlledBrowserType: ok(),
    controlledBrowserSnapshot: ok(), controlledBrowserAction: ok(), controlledBrowserScreenshot: ok(),
    externalWorkspaceStatus: ok(), syncExternalWorkspace: ok(), exportWorkspaceZip: ok(),
    registerWorkspacePreview: ok(), codingGit: ok(),
    getStoreBlob: vi.fn(async () => marker), sandboxExec: ok(), sandboxRead: ok(), sandboxWrite: ok(),
    sandboxEdit: ok(), sandboxGrep: ok(), sandboxLs: ok(), sandboxFind: ok(), sandboxStartBackground: ok(),
    sandboxQueryJob: ok(), sandboxReadJobOutput: ok(), sandboxStopJob: ok(),
    getKnowledgeBaseController: () => ({
      listFilesPaginated: async () => [{ status: 'done', filename: marker }],
      getFilesMeta: async () => marker, search: async () => marker, readFileChunks: async () => marker,
    }),
    getSessionAttachmentRagController: () => ({
      getAttachments: async () => [{ filename: marker, status: 'ready' }],
      query: async () => marker, readParents: async () => marker,
    }),
  }
  return { api, marker }
})
vi.mock('@/mobile/coding-builds', () => ({ startCodingBuildRun: async () => ({ id: 'fixture' }) }))
vi.mock('@/mobile/coding-changes', () => ({ proposeCodingChangeSet: async () => 'fixture' }))
vi.mock('@/mobile/agent-approval', () => ({ requestAgentApproval: async () => true }))
vi.mock('@/platform', () => ({ default: api }))
vi.mock('@/mobile/long-term-memory', () => ({ createDefaultLongTermMemoryService: () => ({
  search: async () => [{ item: { id: 'fixture' } }], saveCandidate: async () => ({ id: 'fixture' }), remove: async () => true,
}) }))

it('executes all exposed sandbox, stored file, KB, attachment and memory tools against fixture backends', async () => {
  const project = CodingProjectRecordSchema.parse({
    schemaVersion: 1, id: marker, taskId: marker, name: marker, targetId: 'web-vite', supportLevel: 'stable',
    source: { kind: 'template' }, workspaceKey: marker, buildConfig: { buildCommand: 'fixture', artifactPatterns: [] },
    status: 'ready', dirtyExternalSync: false, createdAt: 1, updatedAt: 1,
  })
  const tools: ToolSet = { ...workspaceBrowser.tools, ...createCodingToolSet(project).tools, ...sandbox.tools, ...files.tools, ...(await knowledgeBase(1, marker)).tools,
    ...(await attachments([1])).tools, ...createLongTermMemoryToolSet('fixture').tools }
  const path = { file_path: marker }
  const job = { job_id: marker }
  const cases: Record<string, object> = {
    workspace_external_status: {}, workspace_sync_from_external: {}, workspace_sync_to_external: {},
    workspace_export_zip: { share: false }, workspace_preview: { port: 8000, path: '/', open: false },
    workspace_deploy: { command: 'fixture', timeout: 1000 }, browser_navigate: { url: 'https://example.org' },
    browser_click: { ref: marker }, browser_type: { ref: marker, text: marker }, browser_snapshot: {},
    browser_scroll: { direction: 'down', amount: 200 }, browser_wait: { value: marker, timeoutMs: 500 },
    browser_select: { ref: marker, value: marker }, browser_history: { action: 'back' }, browser_screenshot: {},
    coding_propose_changes: { objective: marker, operations: [{ kind: 'create', path: marker, content: marker }] },
    coding_run_profile: { kind: 'test' }, coding_git_status: {}, coding_git_diff: { staged: false },
    coding_git_create_branch: { name: marker }, coding_git_commit: { message: marker }, coding_git_restore_files: { paths: [marker] },
    sandbox_bash: { command: 'echo fixture' }, sandbox_read: path, sandbox_write: { ...path, content: marker },
    sandbox_edit: { ...path, old_text: marker, new_text: 'next' }, sandbox_grep: { pattern: marker },
    sandbox_ls: {}, sandbox_find: {}, sandbox_start_background: { command: 'echo fixture' }, sandbox_job_status: job, poll_workflow_status: job,
    sandbox_job_output: job, sandbox_stop_job: job, read_file: { fileKey: marker },
    search_file_content: { fileKey: marker, query: marker }, query_knowledge_base: { query: marker },
    get_files_meta: { fileIds: [1] }, read_file_chunks: { chunks: [{ fileId: 1, chunkIndex: 0 }] },
    list_files: { page: 0, pageSize: 2 }, list_session_attachments: {}, query_session_attachment: { query: marker },
    read_session_attachment_parents: { parentIds: [marker] }, search_long_term_memory: { query: marker },
    remember_long_term_memory: { content: marker }, forget_long_term_memory: { id: marker },
  }
  expect(Object.keys(tools).sort()).toEqual(Object.keys(cases).sort())
  for (const [name, args] of Object.entries(cases)) {
    const result = await tools[name].execute!(args, { toolCallId: name, messages: [] })
    if (name === 'forget_long_term_memory') expect(result).toEqual({ deleted: true })
    else expect(JSON.stringify(result), name).toContain(marker)
  }
})


it('runs the four structured workspace tools on a disposable plan', async () => {
  const tools = createWorkspaceAgentToolSet('fixture').tools
  const call = { toolCallId: 'fixture', messages: [] }
  const plan = await tools.workspace_plan.execute!({ objective: 'fixture', test_commands: ['fixture'] }, call)
  const payload = { plan: { ...WorkspaceAgentPlanSchema.parse(plan), operations: [{ kind: 'create' as const, path: 'example.txt', content: 'fixture' }] } }
  expect(await tools.workspace_apply_patch.execute!(payload, call)).toHaveProperty('checkpoint', 1)
  expect(await tools.workspace_run_tests.execute!(payload, call)).toHaveProperty('plan.state', 'completed')
  expect(await tools.workspace_git_status.execute!({}, call)).toHaveProperty('exitCode', 0)
})
