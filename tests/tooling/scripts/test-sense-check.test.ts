import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { parseArgs, runTestSenseCheck } from '../../../scripts/test-sense-check.mjs'

const tempDirectories = new Set<string>()

afterEach(() => {
  for (const directoryPath of tempDirectories) {
    fs.rmSync(directoryPath, { force: true, recursive: true })
  }
  tempDirectories.clear()
})

function createTempRepo(files: Record<string, string>) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-sense-check-'))
  tempDirectories.add(rootDir)

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(rootDir, relativePath)
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    fs.writeFileSync(absolutePath, content, 'utf8')
  }

  return rootDir
}

describe('parseArgs', () => {
  it('parses comma-separated changed file arguments', () => {
    expect(parseArgs(['--', '--changed-files', 'tests/unit/a.test.ts,tests/unit/b.test.ts']).changedFiles).toEqual([
      'tests/unit/a.test.ts',
      'tests/unit/b.test.ts',
    ])
  })
})

describe('runTestSenseCheck', () => {
  it('fails unit tests that exercise only local validators', () => {
    const rootDir = createTempRepo({
      'tests/unit/auth/types/authTypes.test.ts': [
        "import { describe, expect, it } from 'vitest'",
        "import type { AuthData } from '@/auth/types/authTypes'",
        '',
        "describe('auth types', () => {",
        '  function isValidAuthData(data: unknown): data is AuthData { return data !== null }',
        "  it('validates local auth data', () => {",
        '    expect(isValidAuthData({})).toBe(true)',
        '  })',
        '})',
      ].join('\n'),
    })

    const result = runTestSenseCheck({ rootDir })

    expect(result.ok).toBe(false)
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Unit tests must exercise production runtime code'),
        expect.stringContaining('Local validator-only tests must be replaced'),
      ]),
    )
  })

  it('routes script and seed tests into dedicated suites', () => {
    const rootDir = createTempRepo({
      'tests/unit/scripts/release.test.ts': "import { describe } from 'vitest'\ndescribe('release', () => {})\n",
      'tests/unit/endpoints/seed/assets.test.ts': [
        "import { describe, expect, it } from 'vitest'",
        "import posts from '@/endpoints/seed/data/demo/posts.json'",
        "describe('posts', () => { it('loads data', () => expect(posts).toBeDefined()) })",
      ].join('\n'),
    })

    const result = runTestSenseCheck({ rootDir })

    expect(result.ok).toBe(false)
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining('tests/unit/scripts/release.test.ts: Tooling scripts must live under tests/tooling/**'),
        expect.stringContaining(
          'tests/unit/endpoints/seed/assets.test.ts: Seed fixture and data-integrity checks must live under tests/data-integrity/**',
        ),
      ]),
    )
  })

  it('passes categorized tooling and data-integrity tests while warning about weak assertions', () => {
    const rootDir = createTempRepo({
      'tests/tooling/scripts/release.test.ts': [
        "import { describe, expect, it } from 'vitest'",
        "import { parseArgs } from '../../../scripts/release.mjs'",
        "describe('release', () => { it('parses branch decisions', () => expect(parseArgs).toBeDefined()) })",
      ].join('\n'),
      'tests/data-integrity/endpoints/seed/assets.test.ts': [
        "import { describe, expect, it } from 'vitest'",
        "import posts from '@/endpoints/seed/data/demo/posts.json'",
        "describe('posts', () => { it('loads data', () => expect(posts).toBeDefined()) })",
      ].join('\n'),
      'tests/unit/components/button.test.tsx': [
        "import { describe, expect, it } from 'vitest'",
        "import { Button } from '@/components/atoms/button'",
        "describe('Button', () => { it('keeps class contract', () => expect(Button).toBeDefined()) })",
        "expect('className rounded-md').toContain('rounded-md')",
      ].join('\n'),
    })

    const result = runTestSenseCheck({ rootDir })

    expect(result.ok).toBe(true)
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('styling/class assertions')]))
  })
})
