import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { runDocsConsistencyCheck } from '../../../scripts/docs-consistency-check.mjs'

const tempDirectories = new Set<string>()

afterEach(() => {
  for (const dirPath of tempDirectories) {
    fs.rmSync(dirPath, { recursive: true, force: true })
  }
  tempDirectories.clear()
})

function createRepo(docsContent: string) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-check-'))
  tempDirectories.add(rootDir)

  fs.mkdirSync(path.join(rootDir, 'docs'), { recursive: true })
  fs.mkdirSync(path.join(rootDir, 'src', 'guide'), { recursive: true })

  fs.writeFileSync(
    path.join(rootDir, 'package.json'),
    JSON.stringify({
      scripts: {
        'docs:check': 'node scripts/docs-consistency-check.mjs',
      },
    }),
    'utf8',
  )

  fs.writeFileSync(path.join(rootDir, 'README.md'), '# Root README\n', 'utf8')
  fs.writeFileSync(path.join(rootDir, 'docs', 'guide.md'), docsContent, 'utf8')
  fs.writeFileSync(path.join(rootDir, 'src', 'guide', 'target.ts'), 'export const target = true\n', 'utf8')

  return rootDir
}

describe('runDocsConsistencyCheck', () => {
  it('fails root-absolute repo links because they break markdown preview navigation', () => {
    const rootDir = createRepo('[Target](/src/guide/target.ts)\n')

    const result = runDocsConsistencyCheck({ rootDir })

    expect(result.ok).toBe(false)
    expect(
      result.failures.some((failure) =>
        failure.includes('invalid repo-local markdown link (use a relative path for preview navigation)'),
      ),
    ).toBe(true)
  })

  it('accepts equivalent relative repo links', () => {
    const rootDir = createRepo('[Target](../src/guide/target.ts)\n')

    const result = runDocsConsistencyCheck({ rootDir })

    expect(result.ok).toBe(true)
    expect(result.failures).toHaveLength(0)
  })
})
