import { randomUUID } from 'node:crypto'

import { postgresAdapter } from '@payloadcms/db-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createLocalReq, getPayload, type Payload } from 'payload'

import config from '@payload-config'
import {
  down as revertInquiryModerationFoundation,
  up as applyInquiryModerationFoundation,
} from '@/migrations/20260824_191853_inquiry_moderation_foundation'
import {
  down as revertInquiryModerationAuditEvents,
  up as applyInquiryModerationAuditEvents,
} from '@/migrations/20260824_193039_inquiry_moderation_audit_events'
import {
  down as revertInquiryModerationMeasureEnd,
  up as applyInquiryModerationMeasureEnd,
} from '@/migrations/20260824_201842_inquiry_moderation_measure_end'
import {
  down as revertInquiryRetentionDeletionFoundation,
  up as applyInquiryRetentionDeletionFoundation,
} from '@/migrations/20260824_205617_inquiry_retention_deletion_foundation'
import {
  down as revertInquiryRetentionContentState,
  up as applyInquiryRetentionContentState,
} from '@/migrations/20260824_205919_inquiry_retention_content_state'
import {
  down as revertInquiryRetentionActiveHoldKey,
  up as applyInquiryRetentionActiveHoldKey,
} from '@/migrations/20260824_230756_inquiry_retention_active_hold_key'
import {
  down as revertInquiryRetentionPolicyEffectiveDate,
  up as applyInquiryRetentionPolicyEffectiveDate,
} from '@/migrations/20260824_233016_inquiry_retention_policy_effective_date'
import {
  down as revertInquiryRetentionDeleteIntentOperation,
  up as applyInquiryRetentionDeleteIntentOperation,
} from '@/migrations/20260824_235512_inquiry_retention_delete_intent_operation'
import { deriveDatabaseConfig } from '../../../scripts/test-database-harness.mjs'

const { Client } = pg

type IsolatedAdapter = ReturnType<ReturnType<typeof postgresAdapter>['init']>
type RetainedPoolClient = { release: (destroy?: boolean) => void }

const quotedTestDatabaseIdentifier = (value: string): string => {
  const prefix = 'findmydoc-test'
  const suffix = value.slice(prefix.length)
  if (!value.startsWith(prefix) || !/^[-_][a-z0-9][a-z0-9_-]*$/u.test(suffix) || value.length > 63) {
    throw new Error(`Unsafe isolated migration database name: ${value}`)
  }
  return `"${value}"`
}

describe('inquiry moderation foundation rollback', () => {
  let adminClient: InstanceType<typeof Client>
  let isolatedAdapter: IsolatedAdapter
  let isolatedDatabaseName: string
  let payload: Payload
  let retainedAdapterClient: RetainedPoolClient | undefined

  beforeAll(async () => {
    payload = await getPayload({ config })
    const databaseConfig = deriveDatabaseConfig()
    isolatedDatabaseName = `findmydoc-test-migration-${randomUUID().replaceAll('-', '').slice(0, 16)}`
    const isolatedIdentifier = quotedTestDatabaseIdentifier(isolatedDatabaseName)
    const templateIdentifier = quotedTestDatabaseIdentifier(databaseConfig.templateDatabaseNames.empty)

    adminClient = new Client({ connectionString: databaseConfig.adminConnectionString })
    await adminClient.connect()
    await adminClient.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1', [
      databaseConfig.templateDatabaseNames.empty,
    ])
    await adminClient.query(`CREATE DATABASE ${isolatedIdentifier} WITH TEMPLATE ${templateIdentifier}`)

    const isolatedConnectionUrl = new URL(databaseConfig.connectionString)
    isolatedConnectionUrl.pathname = `/${isolatedDatabaseName}`
    isolatedAdapter = postgresAdapter({
      pool: { connectionString: isolatedConnectionUrl.toString() },
      push: false,
    }).init({ payload })
    if (!isolatedAdapter.connect) throw new Error('Expected the isolated PostgreSQL adapter to support connect.')
    await isolatedAdapter.connect()
    retainedAdapterClient = (isolatedAdapter.pool as unknown as { _clients?: RetainedPoolClient[] })._clients?.[0]
    if (!retainedAdapterClient) throw new Error('Expected the isolated adapter to retain one PostgreSQL client.')
  }, 60_000)

  afterAll(async () => {
    retainedAdapterClient?.release(true)
    retainedAdapterClient = undefined
    await isolatedAdapter?.pool.end().catch(() => undefined)
    if (isolatedAdapter?.destroy) await isolatedAdapter.destroy().catch(() => undefined)
    if (adminClient && isolatedDatabaseName) {
      await adminClient.query(`DROP DATABASE IF EXISTS ${quotedTestDatabaseIdentifier(isolatedDatabaseName)}`)
    }
    await adminClient?.end().catch(() => undefined)
  })

  it('removes and reapplies the additive moderation schema with its dependent retention schema', async () => {
    const req = await createLocalReq({}, payload)
    const migrationArgs = { db: isolatedAdapter.drizzle, payload, req } as never

    const before = await isolatedAdapter.pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('inquiry_moderation_cases', 'inquiry_moderation_events')
       ORDER BY table_name`,
    )
    expect(before.rows.map(({ table_name }) => table_name)).toEqual([
      'inquiry_moderation_cases',
      'inquiry_moderation_events',
    ])

    await revertInquiryRetentionDeleteIntentOperation(migrationArgs)
    await revertInquiryRetentionPolicyEffectiveDate(migrationArgs)
    await revertInquiryRetentionActiveHoldKey(migrationArgs)
    await revertInquiryRetentionContentState(migrationArgs)
    await revertInquiryRetentionDeletionFoundation(migrationArgs)
    await revertInquiryModerationMeasureEnd(migrationArgs)
    await revertInquiryModerationAuditEvents(migrationArgs)
    await revertInquiryModerationFoundation(migrationArgs)

    const afterDown = await isolatedAdapter.pool.query<{
      communication_table: string | null
      moderation_cases: string | null
      moderation_events: string | null
    }>(
      `SELECT
         to_regclass('public.inquiry_conversations')::text AS communication_table,
         to_regclass('public.inquiry_moderation_cases')::text AS moderation_cases,
         to_regclass('public.inquiry_moderation_events')::text AS moderation_events`,
    )
    expect(afterDown.rows[0]).toEqual({
      communication_table: 'inquiry_conversations',
      moderation_cases: null,
      moderation_events: null,
    })

    await applyInquiryModerationFoundation(migrationArgs)
    await applyInquiryModerationAuditEvents(migrationArgs)
    await applyInquiryModerationMeasureEnd(migrationArgs)
    await applyInquiryRetentionDeletionFoundation(migrationArgs)
    await applyInquiryRetentionContentState(migrationArgs)
    await applyInquiryRetentionActiveHoldKey(migrationArgs)
    await applyInquiryRetentionPolicyEffectiveDate(migrationArgs)
    await applyInquiryRetentionDeleteIntentOperation(migrationArgs)

    const afterUp = await isolatedAdapter.pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'inquiry_moderation_cases'
         AND column_name = 'measure_ended_at'`,
    )
    expect(afterUp.rows).toEqual([{ column_name: 'measure_ended_at' }])
  })
})
