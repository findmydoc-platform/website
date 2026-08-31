import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { createPayloadRuntimePoolConfig } from '@/features/databaseAvailability'

const repositoryRoot = path.resolve(import.meta.dirname, '../../..')
const temporaryDirectories = new Set<string>()

const createPnpmStub = (): string => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-migration-test-'))
  temporaryDirectories.add(temporaryDirectory)
  const pnpmPath = path.join(temporaryDirectory, 'pnpm')

  fs.writeFileSync(
    pnpmPath,
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then
  echo "10.28.2"
  exit 0
fi
echo "database_uri=\${DATABASE_URI:-unset}"
echo "database_direct_uri=\${DATABASE_DIRECT_URI:-unset}"
echo "payload_database_operation=\${PAYLOAD_DATABASE_OPERATION:-unset}"
echo "arguments=$*"
`,
    { mode: 0o755 },
  )

  return temporaryDirectory
}

const runHelper = (overrides: Partial<NodeJS.ProcessEnv>) => {
  const stubDirectory = createPnpmStub()
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CI: '',
    DATABASE_DIRECT_URI: '',
    DATABASE_URI: '',
    DEPLOYMENT_ENV: '',
    VERCEL: '',
    VERCEL_ENV: '',
    ...overrides,
    PATH: `${stubDirectory}:${process.env.PATH ?? ''}`,
  }

  return spawnSync('bash', [path.join(repositoryRoot, '.codex/scripts/payload-migration.sh'), 'migrate:status'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env,
  })
}

const readStubValue = (stdout: string, key: string): string | undefined => {
  const prefix = `${key}=`
  return stdout
    .split('\n')
    .find((line) => line.startsWith(prefix))
    ?.slice(prefix.length)
}

afterEach(() => {
  for (const directory of temporaryDirectories) {
    fs.rmSync(directory, { force: true, recursive: true })
  }
  temporaryDirectories.clear()
})

describe('Payload migration database selection', () => {
  it('routes the standard repository migration command through the guarded helper', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }

    expect(packageJson.scripts?.migrate).toBe('bash .codex/scripts/payload-migration.sh migrate')
  })

  it('uses DATABASE_DIRECT_URI and removes it from the Payload child environment', () => {
    const result = runHelper({
      DATABASE_DIRECT_URI: 'postgresql://direct.example.test:5432/postgres',
      DATABASE_URI: 'postgresql://runtime.example.test:6543/postgres',
      VERCEL: '1',
      VERCEL_ENV: 'preview',
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('database_uri=postgresql://direct.example.test:5432/postgres')
    expect(result.stdout).toContain('database_direct_uri=unset')
    expect(result.stdout).toContain('payload_database_operation=migration')
    expect(result.stdout).toContain('arguments=payload migrate:status')

    const migrationPool = createPayloadRuntimePoolConfig({
      DATABASE_URI: readStubValue(result.stdout, 'database_uri'),
      PAYLOAD_DATABASE_OPERATION: readStubValue(result.stdout, 'payload_database_operation'),
      VERCEL: '1',
      VERCEL_ENV: 'preview',
    })
    expect(migrationPool.connectionString).toBe('postgresql://direct.example.test:5432/postgres')

    expect(() =>
      createPayloadRuntimePoolConfig({
        DATABASE_URI: migrationPool.connectionString,
        VERCEL: '1',
        VERCEL_ENV: 'preview',
      }),
    ).toThrow('DATABASE_URI must use a transaction pooler on port 6543 in Vercel runtimes.')
  })

  it('fails closed in a hosted runtime when DATABASE_DIRECT_URI is missing', () => {
    const result = runHelper({
      DATABASE_URI: 'postgresql://runtime.example.test:6543/postgres',
      VERCEL: '1',
      VERCEL_ENV: 'production',
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('DATABASE_DIRECT_URI is required for hosted Payload migration commands.')
    expect(result.stdout).not.toContain('runtime.example.test')
  })

  it('allows an explicit DATABASE_URI fallback for local and CI Docker databases', () => {
    const result = runHelper({
      CI: 'true',
      DATABASE_URI: 'postgresql://localhost:5432/findmydoc-portal',
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toContain(
      'DATABASE_DIRECT_URI is not set; using DATABASE_URI for a local or CI database command.',
    )
    expect(result.stdout).toContain('database_uri=postgresql://localhost:5432/findmydoc-portal')
  })

  it('keeps the local preview simulator on the local database fallback', () => {
    const result = runHelper({
      DATABASE_URI: 'postgresql://localhost:5432/findmydoc-portal',
      DEPLOYMENT_ENV: 'preview',
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('database_uri=postgresql://localhost:5432/findmydoc-portal')
  })
})
