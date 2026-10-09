import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { runDocsConsistencyCheck } from '../../../scripts/docs-consistency-check.mjs'

describe('documented native pnpm commands', () => {
  it.each([
    ['pnpm dedupe --lockfile-only --ignore-scripts', true],
    ['pnpm invented-command', false],
  ])('validates %s in the root README', (command, expected) => {
    const rootDir = mkdtempSync(path.join(tmpdir(), 'docs-command-'))
    try {
      mkdirSync(path.join(rootDir, 'docs'))
      writeFileSync(path.join(rootDir, 'package.json'), '{"scripts":{}}')
      writeFileSync(path.join(rootDir, 'README.md'), '`' + command + '`')
      expect(runDocsConsistencyCheck({ rootDir }).ok).toBe(expected)
    } finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })
})
