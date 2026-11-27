import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join, dirname } from 'node:path'
const runPython = promisify(execFile)
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new McpServer({ name: 'Yachiyo Discrete Math', version: '1.0.0' })
server.registerTool('gcd', {
  description: 'Greatest common divisor of two safe integers.',
  inputSchema: { a: z.number().int().safe(), b: z.number().int().safe() },
  annotations: { readOnlyHint: true, idempotentHint: true }
}, ({ a, b }) => {
  let x = BigInt(Math.abs(a))
  let y = BigInt(Math.abs(b))
  while (y) [x, y] = [y, x % y]
  return { content: [{ type: 'text', text: x.toString() }] }
})


function pythonMath(name, description, inputSchema) {
  server.registerTool(name, { description, inputSchema, annotations: { readOnlyHint: true, idempotentHint: true } }, async args => {
    try {
      const { stdout } = await runPython(process.env.YACHIYO_MATH_PYTHON || 'python3',
        ['-I', join(dirname(process.argv[1]), 'discrete.py'), name, JSON.stringify(args)], { timeout: 15000, maxBuffer: 65536 })
      return { content: [{ type: 'text', text: stdout.trim() }] }
    } catch (err) {
      const missing = err.stderr?.match(/No module named '([a-zA-Z0-9_]+)'/)
      return { isError: true, content: [{ type: 'text', text: missing ? 'Install the desktop math library: ' + missing[1] : 'Calculation failed. Check the inputs and desktop Python environment.' }] }
    }
  })
}
const integer = z.number().int().safe()
pythonMath('factor_polynomial', 'Factor a polynomial from coefficients in descending degree.',
  { coefficients: z.array(integer).min(1).max(65) })
pythonMath('shortest_path', 'Find a shortest path in an undirected graph.',
  { edges: z.array(z.tuple([z.string().max(128), z.string().max(128)])).max(2000), start: z.string().max(128), end: z.string().max(128) })
pythonMath('integer_solution', 'Solve integer equations of the form a*x + b*y = c.',
  { equations: z.array(z.tuple([integer, integer, integer])).min(1).max(64) })

void server.connect(new StdioServerTransport())
