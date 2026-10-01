import { readFile } from 'node:fs/promises'
import { Socket } from 'node:net'
import http from 'node:http'
import https from 'node:https'
import dgram from 'node:dgram'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { validateSuppressionMigration } from '../../scripts/supabase-native-mail-suppression.mjs'

const migrationPath = new URL('../../supabase/migrations/20261001103540_native_mail_suppression.sql', import.meta.url)
let database: PGlite

beforeAll(async () => {
  database = new PGlite()
  await database.exec(
    'create role anon; create role authenticated; create role supabase_auth_admin; create role service_role; create role unrelated_client;',
  )
  await database.exec(await readFile(migrationPath, 'utf8'))
})

afterAll(async () => {
  await database?.close()
})

describe('Supabase native-mail suppression SQL', () => {
  it('acknowledges a native email request with the supported empty success result', async () => {
    await database.exec('set role supabase_auth_admin')
    try {
      const result = await database.query<{ result: unknown }>(
        'select auth_mail_suppression.send_email_v1($1::jsonb) as result',
        [{ email: { email_action_type: 'signup' } }],
      )
      expect(result.rows).toEqual([{ result: {} }])
    } finally {
      await database.exec('reset role')
    }
  })

  it.each(['anon', 'authenticated', 'service_role', 'unrelated_client'])(
    'denies %s both effective privileges and an actual invocation',
    async (role) => {
      const privileges = await database.query<{ schema_usage: boolean; execute: boolean }>(
        `select has_schema_privilege($1, 'auth_mail_suppression', 'USAGE') as schema_usage,
          has_function_privilege($1, 'auth_mail_suppression.send_email_v1(jsonb)', 'EXECUTE') as execute`,
        [role],
      )
      expect(privileges.rows).toEqual([{ schema_usage: false, execute: false }])
      await database.exec(`set role ${role}`)
      try {
        await expect(database.query("select auth_mail_suppression.send_email_v1('{}'::jsonb)")).rejects.toMatchObject({
          code: '42501',
        })
      } finally {
        await database.exec('reset role')
      }
    },
  )

  it('lets Auth invoke the function without granting schema creation rights', async () => {
    const result = await database.query(
      `select has_schema_privilege('supabase_auth_admin', 'auth_mail_suppression', 'USAGE') as usage,
        has_schema_privilege('supabase_auth_admin', 'auth_mail_suppression', 'CREATE') as create,
        has_function_privilege('supabase_auth_admin', 'auth_mail_suppression.send_email_v1(jsonb)', 'EXECUTE') as execute`,
    )
    expect(result.rows).toEqual([{ usage: true, create: false, execute: true }])
  })

  it('installs an invoker SQL function with an empty search path and a constant body', async () => {
    const result = await database.query(
      `select p.prosecdef as security_definer, p.proconfig as settings, btrim(p.prosrc, E' \\t\\n\\r') as body,
        p.proargnames as arguments, pg_get_function_identity_arguments(p.oid) as signature,
        pg_get_function_result(p.oid) as result_type, l.lanname as language
      from pg_proc p join pg_language l on l.oid = p.prolang
      where p.oid = 'auth_mail_suppression.send_email_v1(jsonb)'::regprocedure`,
    )
    expect(result.rows).toEqual([
      {
        security_definer: false,
        settings: ['search_path=""'],
        body: "select '{}'::jsonb;",
        arguments: ['event'],
        signature: 'event jsonb',
        result_type: 'jsonb',
        language: 'sql',
      },
    ])
  })

  it.each([{}, { email: { email_action_type: 'recovery' } }, [], false, null])(
    'ignores the input shape and returns the same success contract',
    async (input) => {
      const result = await database.query('select auth_mail_suppression.send_email_v1($1::jsonb) as result', [
        JSON.stringify(input),
      ])
      expect(result.rows).toEqual([{ result: {} }])
    },
  )

  it('executes the real migration and hook with external network and console logging blocked', async () => {
    const blocked = () => {
      throw new Error('External network access is forbidden in suppression tests.')
    }
    const attempts = [
      vi.spyOn(globalThis, 'fetch').mockImplementation(blocked),
      vi.spyOn(Socket.prototype, 'connect').mockImplementation(blocked),
      vi.spyOn(dgram, 'createSocket').mockImplementation(blocked),
      vi.spyOn(http, 'request').mockImplementation(blocked),
      vi.spyOn(http, 'get').mockImplementation(blocked),
      vi.spyOn(https, 'request').mockImplementation(blocked),
      vi.spyOn(https, 'get').mockImplementation(blocked),
      vi.spyOn(console, 'log').mockImplementation(() => {}),
      vi.spyOn(console, 'warn').mockImplementation(() => {}),
      vi.spyOn(console, 'error').mockImplementation(() => {}),
      vi.spyOn(console, 'info').mockImplementation(() => {}),
      vi.spyOn(console, 'debug').mockImplementation(() => {}),
    ]
    const offline = new PGlite()
    try {
      await offline.exec('create role anon; create role authenticated; create role supabase_auth_admin;')
      const sql = await readFile(migrationPath, 'utf8')
      expect(validateSuppressionMigration(sql)).toEqual({ ok: true })
      await offline.exec(sql)
      await offline.exec('set role supabase_auth_admin')
      const result = await offline.query("select auth_mail_suppression.send_email_v1('{}'::jsonb) as result")
      expect(result.rows).toEqual([{ result: {} }])
      for (const attempt of attempts) expect(attempt).not.toHaveBeenCalled()
    } finally {
      await offline.close()
      vi.restoreAllMocks()
    }
  })
})
