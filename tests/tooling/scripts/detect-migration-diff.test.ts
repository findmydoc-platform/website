import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

const tempDirectories = new Set<string>()
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

afterEach(() => {
  for (const directoryPath of tempDirectories) {
    fs.rmSync(directoryPath, { force: true, recursive: true })
  }

  tempDirectories.clear()
})

const initialPayloadConfig = `import { seedGetHandler } from './endpoints/seed/seedEndpoint'

export default {
  endpoints: [
    { path: '/seed', method: 'get', handler: seedGetHandler as PayloadHandler },
  ],
}
`

const createTempRepo = () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-migration-diff-'))
  tempDirectories.add(rootDir)

  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true })
  fs.writeFileSync(path.join(rootDir, 'src', 'payload.config.ts'), initialPayloadConfig, 'utf8')

  runGit(rootDir, ['init'])
  runGit(rootDir, ['config', 'user.email', 'tests@example.com'])
  runGit(rootDir, ['config', 'user.name', 'Test Runner'])
  runGit(rootDir, ['add', '.'])
  runGit(rootDir, ['commit', '--message', 'initial config'])

  return rootDir
}

const runGit = (rootDir: string, args: string[]) => {
  execFileSync('git', args, { cwd: rootDir, stdio: 'pipe' })
}

const commitPayloadConfig = (rootDir: string, source: string) => {
  fs.writeFileSync(path.join(rootDir, 'src', 'payload.config.ts'), source, 'utf8')
  runGit(rootDir, ['add', 'src/payload.config.ts'])
  runGit(rootDir, ['commit', '--message', 'update payload config'])
}

const commitFile = (rootDir: string, relativePath: string, source: string) => {
  const filePath = path.join(rootDir, relativePath)

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, source, 'utf8')
  runGit(rootDir, ['add', relativePath])
  runGit(rootDir, ['commit', '--message', `update ${relativePath}`])
}

const runDetector = (rootDir: string) => {
  const outputPath = path.join(rootDir, 'github-output')
  execFileSync('bash', [path.join(repositoryRoot, '.github/scripts/ci/detect-migration-diff.sh'), 'push', ''], {
    cwd: rootDir,
    env: { ...process.env, GITHUB_OUTPUT: outputPath },
    stdio: 'pipe',
  })

  return fs.readFileSync(outputPath, 'utf8')
}

describe('detect-migration-diff', () => {
  it('does not require a migration for an endpoint-only Payload config change', () => {
    const rootDir = createTempRepo()

    commitPayloadConfig(
      rootDir,
      `import { cacheRevalidationVisibilityGetHandler } from './endpoints/cacheRevalidationVisibility'
import { seedGetHandler } from './endpoints/seed/seedEndpoint'

export default {
  endpoints: [
    { path: '/seed', method: 'get', handler: seedGetHandler as PayloadHandler },
    {
      path: '/cache-revalidation/visibility',
      method: 'get',
      handler: cacheRevalidationVisibilityGetHandler as PayloadHandler,
    },
  ],
}
`,
    )

    const output = runDetector(rootDir)

    expect(output).toContain('db_changed=false')
    expect(output).toContain('schema_changed=false')
  })

  it('keeps non-endpoint Payload config changes schema-relevant', () => {
    const rootDir = createTempRepo()

    commitPayloadConfig(
      rootDir,
      `${initialPayloadConfig}\nexport const generatedTypes = { outputFile: 'src/payload-types.ts' }\n`,
    )

    const output = runDetector(rootDir)

    expect(output).toContain('db_changed=true')
    expect(output).toContain('schema_changed=true')
  })

  it('does not require a migration for scoped agent instructions', () => {
    const rootDir = createTempRepo()

    commitFile(rootDir, 'src/collections/AGENTS.md', '# Collection instructions\n')

    const output = runDetector(rootDir)

    expect(output).toContain('db_changed=false')
    expect(output).toContain('schema_changed=false')
  })

  it('keeps collection config changes schema-relevant', () => {
    const rootDir = createTempRepo()

    commitFile(rootDir, 'src/collections/Doctors/index.ts', "export const Doctors = { slug: 'doctors' }\n")

    const output = runDetector(rootDir)

    expect(output).toContain('db_changed=true')
    expect(output).toContain('schema_changed=true')
  })
})
