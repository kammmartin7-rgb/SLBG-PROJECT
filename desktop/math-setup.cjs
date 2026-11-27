const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { existsSync, mkdirSync } = require('node:fs')
const { join } = require('node:path')
const run = promisify(execFile)
function mathPython(root) {
  const venv = join(root, 'discrete-math-v1', 'bin', 'python')
  if (existsSync(venv)) return venv
  return process.env.YACHIYO_MATH_PYTHON || ['/usr/local/bin/python3','/opt/homebrew/bin/python3','/usr/bin/python3'].find(existsSync) || 'python3'
}
async function setupMath(root) {
  mkdirSync(root, { recursive: true })
  const dir = join(root, 'discrete-math-v1')
  if (!existsSync(join(dir, 'bin', 'python'))) await run(mathPython(root), ['-m', 'venv', dir], { timeout: 60000 })
  const python = join(dir, 'bin', 'python')
  try {
    await run(python, ['-m','pip','--isolated','install','--index-url','https://pypi.org/simple','--only-binary=:all:',
    'sympy==1.14.0','networkx==3.5','z3-solver==4.13.4.0'], { timeout: 180000 })
  } catch { throw Error('Could not install packages from PyPI. Check the connection to pypi.org and files.pythonhosted.org, then retry.') }
  await run(python, ['-I','-c','import sympy, networkx, z3'], { timeout: 10000 })
}
module.exports = { mathPython, setupMath }
