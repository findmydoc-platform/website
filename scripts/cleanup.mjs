#!/usr/bin/env node

import { existsSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Remove only generated artifacts and caches so archived worktrees stay small.
const cleanupTargets = [
  'node_modules',
  '.next',
  'tmp',
  'src/public',
  'build',
  'dist',
  'coverage',
  'test-results',
  'playwright-report',
  'output/playwright',
  'storybook-static',
  '.pnpm-store',
  '.eslintcache',
  'tsconfig.tsbuildinfo',
  'build-storybook.log',
  'debug-storybook.log',
  'public/media',
  'public/clinic-media',
]

let removedCount = 0

for (const relativePath of cleanupTargets) {
  const absolutePath = resolve(repoRoot, relativePath)

  if (!existsSync(absolutePath)) {
    continue
  }

  rmSync(absolutePath, { force: true, recursive: true })
  removedCount += 1
  console.log(`Removed ${relativePath}`)
}

if (removedCount === 0) {
  console.log('No cleanup targets found.')
}
