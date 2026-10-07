import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createPlan } from './plan.mjs'
import { collectChanges } from './changes.mjs'

const args = process.argv.slice(2)
const arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback)
const topic = arg('--topic')
const base = arg('--base')
const head = arg('--head')
const input = base || head ? collectChanges(base, head) : undefined
const plan = createPlan(topic, arg('--variant', 'candidate'), input, { group: arg('--group') })
const output = path.resolve(arg('--output', 'tmp/ci-selection-poc/plan.json'))
mkdirSync(path.dirname(output), { recursive: true })
writeFileSync(output, JSON.stringify(plan, null, 2))
if (process.env.GITHUB_OUTPUT) {
  const { appendFileSync } = await import('node:fs')
  appendFileSync(process.env.GITHUB_OUTPUT, `run=${plan.execution.mode !== 'skip' && topic !== 'e2e'}\n`)
}
console.log(
  JSON.stringify({ topic, mode: plan.execution.mode, files: plan.execution.files, reasons: plan.execution.reasons }),
)
