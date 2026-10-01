import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  checkSuppressionRepository,
  suppressionFingerprint,
  validateSuppressionDeclaration,
  validateSuppressionMigration,
} from '../../../scripts/supabase-native-mail-suppression.mjs'

const declarationPath = new URL('../../../supabase/native-mail-suppression.json', import.meta.url)
const migrationPath = new URL(
  '../../../supabase/migrations/20261001103540_native_mail_suppression.sql',
  import.meta.url,
)
const declaration = () => readFile(declarationPath, 'utf8').then(JSON.parse)

describe('Supabase suppression declaration gate', () => {
  it('rejects a missing expected declaration with a content-free reason', () => {
    expect(validateSuppressionDeclaration(undefined)).toEqual({ ok: false, issues: ['missing-declaration'] })
  })

  it('accepts the reviewed function and permission fingerprints without claiming a runtime binding', async () => {
    const value = await declaration()
    expect(validateSuppressionDeclaration(value)).toEqual({
      ok: true,
      fingerprints: {
        function: value.fingerprints.function,
        permissions: value.fingerprints.permissions,
      },
    })
  })

  it.each(['function', 'permissions'] as const)('rejects a stale %s fingerprint', async (key) => {
    const value = await declaration()
    value.fingerprints[key] = '0'.repeat(64)
    expect(validateSuppressionDeclaration(value)).toMatchObject({
      ok: false,
      issues: [key === 'function' ? 'function-fingerprint-mismatch' : 'permission-fingerprint-mismatch'],
    })
  })

  it.each([
    { change: 'public schema', field: 'schema', value: 'public' },
    { change: 'elevated execution', field: 'security', value: 'definer' },
    { change: 'rendering or network dependency', field: 'body', value: 'select send_via_provider(event);' },
    { change: 'mutable search path', field: 'searchPath', value: ['public'] },
  ])('rejects $change even with a recomputed function fingerprint', async ({ field, value: replacement }) => {
    const value = await declaration()
    value.function[field] = replacement
    value.fingerprints.function = suppressionFingerprint(value.function)
    expect(validateSuppressionDeclaration(value)).toMatchObject({ ok: false, issues: ['unexpected-function'] })
  })

  it('rejects a broader permission contract even with its matching fingerprint', async () => {
    const value = await declaration()
    value.permissions.function.execute.push('authenticated')
    value.fingerprints.permissions = suppressionFingerprint(value.permissions)
    expect(validateSuppressionDeclaration(value)).toMatchObject({ ok: false, issues: ['unexpected-permissions'] })
  })

  it('returns no untrusted input in validation diagnostics', async () => {
    const value = await declaration()
    value.function.body = 'synthetic-untrusted-detail'
    expect(validateSuppressionDeclaration(value)).toEqual({
      ok: false,
      issues: ['unexpected-function', 'function-fingerprint-mismatch'],
    })
  })

  it.each(['select send_via_provider(event);', 'select event;', "select '{}'::jsonb; select persist_event(event);"])(
    'rejects SQL dependencies or payload use before any database execution',
    async (body) => {
      const sql = (await readFile(migrationPath, 'utf8')).replace("select '{}'::jsonb;", body)
      expect(validateSuppressionMigration(sql)).toEqual({ ok: false, issues: ['unexpected-migration'] })
    },
  )

  it('enforces the actual repository declaration and migration in the CI tooling suite', async () => {
    expect(await checkSuppressionRepository()).toEqual({ ok: true })
  })

  it('fails closed when declaration files are absent, malformed, or refer to a missing migration', async () => {
    const root = await mkdtemp(join(tmpdir(), 'suppression-declaration-'))
    try {
      expect(await checkSuppressionRepository(root)).toEqual({ ok: false, issues: ['unreadable-declaration'] })
      await mkdir(join(root, 'supabase'))
      await writeFile(join(root, 'supabase/native-mail-suppression.json'), 'synthetic-unparseable-data')
      expect(await checkSuppressionRepository(root)).toEqual({ ok: false, issues: ['unreadable-declaration'] })
      await writeFile(join(root, 'supabase/native-mail-suppression.json'), JSON.stringify(await declaration()))
      expect(await checkSuppressionRepository(root)).toEqual({ ok: false, issues: ['unreadable-migration'] })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
