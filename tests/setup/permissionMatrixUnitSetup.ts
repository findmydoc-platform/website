import { spawnSync } from 'node:child_process'
import { mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Ensure tmp directory exists for test artifact
mkdirSync(resolve('tmp'), { recursive: true })

// Generate only the JSON snapshot into tmp/ for unit tests
const outPath = resolve('tmp/permission-matrix.json')
if (!existsSync(outPath)) {
  const res = spawnSync('pnpm', ['-s', 'exec', 'tsx', 'scripts/permission-matrix/derive-json.ts', 'json'], {
    stdio: 'inherit',
  })
  if (res.status !== 0) {
    throw new Error(`Failed to derive permission matrix JSON for unit tests (exit=${res.status})`)
  }
}
