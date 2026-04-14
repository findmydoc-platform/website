#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const hooksDir = path.join(repoRoot, '.githooks')

const runGit = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim()

if (process.env.CI === 'true') {
  console.log('[hooks] skipping hook installation in CI.')
  process.exit(0)
}

try {
  if (runGit(['rev-parse', '--is-inside-work-tree']) !== 'true') {
    console.log('[hooks] skipping hook installation outside a Git worktree.')
    process.exit(0)
  }
} catch {
  console.log('[hooks] skipping hook installation outside a Git worktree.')
  process.exit(0)
}

if (!fs.existsSync(hooksDir)) {
  console.log('[hooks] skipping hook installation because .githooks is missing.')
  process.exit(0)
}

runGit(['config', 'core.hooksPath', '.githooks'])

for (const entry of fs.readdirSync(hooksDir, { withFileTypes: true })) {
  if (!entry.isFile()) continue

  const hookPath = path.join(hooksDir, entry.name)
  fs.chmodSync(hookPath, 0o755)
}

console.log('[hooks] configured core.hooksPath=.githooks')
