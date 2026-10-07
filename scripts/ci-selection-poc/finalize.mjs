import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { validateRun } from './results.mjs'
const root = process.argv[2]
const find = (name, directory = root) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      const found = find(name, file)
      if (found) return found
    } else if (entry.name === name) return file
  }
}
const planFile = find('plan.json')
if (!planFile) throw new Error('Classification report missing')
const plan = JSON.parse(readFileSync(planFile, 'utf8'))
const receiptFile = find('receipt.json')
let receipt
try {
  if (plan.topic === 'e2e') {
    receipt = {
      ...plan,
      status: 'blocked',
      failure: 'No immutable deployment/source/database identity evidence supplied; E2E was not executed.',
    }
  } else if (plan.execution.mode === 'skip') {
    if (process.env.WORK_RESULT !== 'skipped') throw new Error('Intentional skip has unexpected worker outcome')
    receipt = {
      topic: plan.topic,
      variant: plan.variant,
      scenario: plan.scenario,
      mode: 'skip',
      status: 'success',
      reasons: plan.execution.reasons,
      round: Number(process.env.ROUND),
      commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      node: process.version,
      pnpm: '10.28.2',
      topology: 'one-serial-runner',
      coverageContract: 'not-executed',
      expectedFiles: [],
    }
  } else {
    if (!receiptFile || !existsSync(receiptFile)) throw new Error('Required worker receipt missing')
    receipt = JSON.parse(readFileSync(receiptFile, 'utf8'))
    if (process.env.WORK_RESULT !== 'success') receipt.status = 'failure'
  }
  if (receipt.status !== 'blocked') validateRun(receipt)
} catch (error) {
  receipt = { ...receipt, topic: plan.topic, variant: plan.variant, status: 'failure', failure: error.message }
  process.exitCode = 1
}
writeFileSync(path.join(root, 'result.json'), JSON.stringify(receipt, null, 2))
console.log(JSON.stringify({ status: receipt.status, mode: receipt.mode, coverageContract: receipt.coverageContract }))
