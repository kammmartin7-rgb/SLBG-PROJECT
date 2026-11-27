const { randomUUID } = require('node:crypto')
const fs = require('node:fs')
const { join } = require('node:path')

// One desktop owns this queue. Queued questions resume after launch. An interrupted
// request has an unknown outcome, so only an explicit new request can repeat it.
function desktopWorkflows(root, ask) {
  fs.mkdirSync(root, { recursive: true, mode: 0o700 })
  const path = join(root, 'desktop-workflows-v1.json')
  let jobs = []
  try { jobs = JSON.parse(fs.readFileSync(path, 'utf8')) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  let active = false
  let closed = false
  function save() {
    fs.writeFileSync(path + '.tmp', JSON.stringify(jobs), { mode: 0o600 })
    fs.renameSync(path + '.tmp', path)
  }
  for (const job of jobs) {
    if (job.status === 'running') job.status = 'interrupted'
  }
  save()
  async function drain() {
    if (active || closed) return
    active = true
    try {
      while (!closed) {
        const job = jobs.find(item => item.status === 'queued')
        if (!job) break
        job.status = 'running'
        save()
        try {
          const answer = await ask(job.question)
          if (closed) break
          job.answer = answer
          job.status = 'completed'
        } catch {
          if (closed) break
          job.status = 'failed'
        }
        delete job.question
        save()
      }
    } finally { active = false }
  }
  const schedule = () => { void drain().catch(() => { closed = true }) }
  setImmediate(schedule)
  return {
    submit(profile, question) {
      if (closed) throw Error('Desktop scheduler unavailable')
      if (jobs.filter(job => ['queued','running'].includes(job.status)).length >= 16) throw Error('Desktop queue full')
      const job = { id: randomUUID(), profile, question, status: 'queued' }
      if (jobs.length >= 256) jobs.splice(jobs.findIndex(item => !['queued','running'].includes(item.status)), 1)
      jobs.push(job)
      save()
      setImmediate(schedule)
      return { job_id: job.id, status: job.status }
    },
    poll(profile, id) {
      const job = jobs.find(item => item.profile === profile && item.id === id)
      if (!job) throw Error('Unknown workflow')
      return { job_id: job.id, status: job.status, answer: job.answer }
    },
    close() { closed = true }
  }
}
module.exports = { desktopWorkflows }
