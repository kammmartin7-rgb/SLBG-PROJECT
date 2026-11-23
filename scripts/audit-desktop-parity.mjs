import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.join(process.cwd(), 'src/renderer')
const findings = []

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.(ts|tsx|css)$/.test(entry.name) && !entry.name.includes('.test.')) {
      const text = fs.readFileSync(full, 'utf8')
      const rel = path.relative(process.cwd(), full)

      if (text.includes('require_the_android_app')) {
        findings.push(`[ANDROID_BLOCKER] ${rel}: still contains *_require_the_android_app error string`)
      }
      if (rel.endsWith('skills.tsx') || rel.includes('SkillsSection')) {
        const matches = text.match(/Web Design Guidelines/g) || []
        if (matches.length > 1) {
          findings.push(`[DUPLICATE_DATA] ${rel}: "Web Design Guidelines" appears ${matches.length} times in source`)
        }
      }
    }
  }
}

walk(ROOT)
fs.writeFileSync('/tmp/holistic-audit.txt', findings.join('\n') || 'CLEAN')
console.log('=== HOLISTIC PARITY AUDIT ===')
console.log(findings.length ? findings.join('\n') : 'ALL CHECKS PASSED')
if (findings.length) process.exit(1)
