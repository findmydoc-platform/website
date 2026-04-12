import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  computeTestDatabaseFingerprint,
  deriveDatabaseConfig,
  deriveTemplateDatabaseName,
  getTemplateFingerprintInputPaths,
  isTemplateMetadataCurrent,
  resolveRequiredTemplateKinds,
  resolveTemplateKind,
} from '../../../scripts/test-database-harness.mjs'

const tempDirectories = new Set<string>()

afterEach(() => {
  for (const directoryPath of tempDirectories) {
    fs.rmSync(directoryPath, { force: true, recursive: true })
  }

  tempDirectories.clear()
})

function createTempRepo() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-db-harness-'))
  tempDirectories.add(rootDir)

  fs.mkdirSync(path.join(rootDir, 'src', 'migrations'), { recursive: true })
  fs.mkdirSync(path.join(rootDir, 'src', 'endpoints', 'seed'), { recursive: true })
  fs.writeFileSync(path.join(rootDir, 'src', 'payload.config.ts'), 'export default {}\n', 'utf8')

  return rootDir
}

describe('resolveTemplateKind', () => {
  it('defaults to the empty template', () => {
    expect(resolveTemplateKind(undefined)).toBe('empty')
  })

  it('accepts the baseline template explicitly', () => {
    expect(resolveTemplateKind('baseline')).toBe('baseline')
  })

  it('rejects unsupported template kinds', () => {
    expect(() => resolveTemplateKind('demo' as never)).toThrow('Unsupported test database template kind: demo')
  })
})

describe('deriveTemplateDatabaseName', () => {
  it('appends the template suffix to regular database names', () => {
    expect(deriveTemplateDatabaseName('findmydoc-test', 'empty')).toBe('findmydoc-test_template_empty')
    expect(deriveTemplateDatabaseName('findmydoc-test', 'baseline')).toBe('findmydoc-test_template_baseline')
  })

  it('keeps long template names within Postgres limits', () => {
    const databaseName = deriveTemplateDatabaseName('findmydoc-test-'.repeat(8), 'baseline')

    expect(databaseName.length).toBeLessThanOrEqual(63)
    expect(databaseName).toContain('template_baseline')
  })
})

describe('deriveDatabaseConfig', () => {
  it('derives admin and template database names from DATABASE_URI', () => {
    const config = deriveDatabaseConfig('postgresql://postgres:password@localhost:5433/findmydoc-test')

    expect(config.adminConnectionString).toBe('postgresql://postgres:password@localhost:5433/postgres')
    expect(config.targetDatabaseName).toBe('findmydoc-test')
    expect(config.templateDatabaseNames).toEqual({
      baseline: 'findmydoc-test_template_baseline',
      empty: 'findmydoc-test_template_empty',
    })
  })

  it('fails when DATABASE_URI does not contain a database name', () => {
    expect(() => deriveDatabaseConfig('postgresql://postgres:password@localhost:5433')).toThrow(
      'DATABASE_URI must include a database name',
    )
  })
})

describe('computeTestDatabaseFingerprint', () => {
  it('changes when migration input files change', () => {
    const rootDir = createTempRepo()
    const migrationFile = path.join(rootDir, 'src', 'migrations', '001_initial.sql')

    fs.writeFileSync(migrationFile, 'create table clinics(id uuid primary key);\n', 'utf8')
    fs.writeFileSync(
      path.join(rootDir, 'src', 'endpoints', 'seed', 'baseline.ts'),
      'export const baseline = 1\n',
      'utf8',
    )

    const initialFingerprint = computeTestDatabaseFingerprint({ rootDir, templateKind: 'empty' })

    fs.writeFileSync(migrationFile, 'create table clinics(id uuid primary key, name text);\n', 'utf8')

    expect(computeTestDatabaseFingerprint({ rootDir, templateKind: 'empty' })).not.toBe(initialFingerprint)
  })

  it('changes the baseline template fingerprint when seed input files change', () => {
    const rootDir = createTempRepo()
    const seedFile = path.join(rootDir, 'src', 'endpoints', 'seed', 'baseline.ts')

    fs.writeFileSync(path.join(rootDir, 'src', 'migrations', '001_initial.sql'), 'select 1;\n', 'utf8')
    fs.writeFileSync(seedFile, 'export const baseline = 1\n', 'utf8')

    const initialFingerprint = computeTestDatabaseFingerprint({ rootDir, templateKind: 'baseline' })

    fs.writeFileSync(seedFile, 'export const baseline = 2\n', 'utf8')

    expect(computeTestDatabaseFingerprint({ rootDir, templateKind: 'baseline' })).not.toBe(initialFingerprint)
  })

  it('does not change the empty template fingerprint when only seed files change', () => {
    const rootDir = createTempRepo()
    const seedFile = path.join(rootDir, 'src', 'endpoints', 'seed', 'baseline.ts')

    fs.writeFileSync(path.join(rootDir, 'src', 'migrations', '001_initial.sql'), 'select 1;\n', 'utf8')
    fs.writeFileSync(seedFile, 'export const baseline = 1\n', 'utf8')

    const initialFingerprint = computeTestDatabaseFingerprint({ rootDir, templateKind: 'empty' })

    fs.writeFileSync(seedFile, 'export const baseline = 2\n', 'utf8')

    expect(computeTestDatabaseFingerprint({ rootDir, templateKind: 'empty' })).toBe(initialFingerprint)
  })
})

describe('template dependencies', () => {
  it('only requires the empty template for integration-style runs', () => {
    expect(resolveRequiredTemplateKinds('empty')).toEqual(['empty'])
  })

  it('requires empty plus baseline for baseline-backed runs', () => {
    expect(resolveRequiredTemplateKinds('baseline')).toEqual(['empty', 'baseline'])
  })

  it('uses seed inputs only for the baseline template fingerprint', () => {
    expect(getTemplateFingerprintInputPaths('empty')).toEqual(['src/migrations', 'src/payload.config.ts'])
    expect(getTemplateFingerprintInputPaths('baseline')).toEqual([
      'src/migrations',
      'src/endpoints/seed',
      'src/payload.config.ts',
    ])
  })
})

describe('isTemplateMetadataCurrent', () => {
  const fingerprint = 'abc123'

  it('accepts matching fingerprint and template kind', () => {
    expect(
      isTemplateMetadataCurrent({ fingerprint, templateKind: 'baseline' }, { fingerprint, templateKind: 'baseline' }),
    ).toBe(true)
  })

  it('invalidates stale fingerprints and wrong template kinds', () => {
    expect(
      isTemplateMetadataCurrent(
        { fingerprint: 'old', templateKind: 'baseline' },
        { fingerprint, templateKind: 'baseline' },
      ),
    ).toBe(false)

    expect(
      isTemplateMetadataCurrent({ fingerprint, templateKind: 'empty' }, { fingerprint, templateKind: 'baseline' }),
    ).toBe(false)
  })
})
