import { randomUUID } from 'node:crypto'

import { postgresAdapter } from '@payloadcms/db-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createLocalReq, getPayload, type Payload } from 'payload'

import config from '@payload-config'
import {
  down as revertInquiryRetentionFoundation,
  up as applyInquiryRetentionFoundation,
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
import {
  down as revertInquiryIdentityPackageDeletion,
  up as applyInquiryIdentityPackageDeletion,
} from '@/migrations/20260825_054030_inquiry_identity_package_deletion'
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

describe('inquiry retention foundation rollback', () => {
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

  it('removes and reapplies only the additive retention schema in dependency order', async () => {
    const req = await createLocalReq({}, payload)
    const migrationArgs = { db: isolatedAdapter.drizzle, payload, req } as never

    await revertInquiryIdentityPackageDeletion(migrationArgs)
    await applyInquiryIdentityPackageDeletion(migrationArgs)
    await isolatedAdapter.pool.query('ALTER TABLE patient_clinic_inquiries DISABLE TRIGGER ALL')
    await isolatedAdapter.pool.query(
      `INSERT INTO patient_clinic_inquiries (
         clinic_id,
         full_name,
         email,
         phone_number,
         message,
         consent_accepted,
         status
       ) VALUES (-1, NULL, NULL, NULL, NULL, false, 'submitted')`,
    )
    await isolatedAdapter.pool.query('ALTER TABLE patient_clinic_inquiries ENABLE TRIGGER ALL')
    await expect(revertInquiryIdentityPackageDeletion(migrationArgs)).rejects.toThrow(
      /Cannot roll back inquiry identity deletion after an identity scrub/u,
    )
    const identityGuardedState = await isolatedAdapter.pool.query<{
      content_state_column: string | null
      scrubbed_rows: string
    }>(
      `SELECT
         (SELECT count(*)::text FROM patient_clinic_inquiries WHERE full_name IS NULL) AS scrubbed_rows,
         (
           SELECT column_name
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'inquiry_internal_notes'
             AND column_name = 'content_state'
         ) AS content_state_column`,
    )
    expect(identityGuardedState.rows[0]).toEqual({ content_state_column: 'content_state', scrubbed_rows: '1' })
    await isolatedAdapter.pool.query('DELETE FROM patient_clinic_inquiries WHERE full_name IS NULL')
    await revertInquiryIdentityPackageDeletion(migrationArgs)
    const identityAfterDown = await isolatedAdapter.pool.query<{
      content_state_column: string | null
      full_name_nullable: string
    }>(
      `SELECT
         (
           SELECT is_nullable
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'patient_clinic_inquiries'
             AND column_name = 'full_name'
         ) AS full_name_nullable,
         (
           SELECT column_name
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'inquiry_internal_notes'
             AND column_name = 'content_state'
         ) AS content_state_column`,
    )
    expect(identityAfterDown.rows[0]).toEqual({ content_state_column: null, full_name_nullable: 'NO' })
    await applyInquiryIdentityPackageDeletion(migrationArgs)

    await isolatedAdapter.pool.query('ALTER TABLE inquiry_deletion_proofs DISABLE TRIGGER ALL')
    await isolatedAdapter.pool.query(
      `INSERT INTO inquiry_deletion_proofs (
         inquiry_id,
         tombstone_key,
         operation,
         reason_category,
         performed_by_id,
         performed_at,
         policy_version,
         deleted_object_count
       ) VALUES ($1, $2, 'hard-delete-pending', 'authorized-erasure', -1, now(), '2026-08-24', 0)`,
      ['synthetic-pending-rollback-inquiry', 'synthetic-pending-rollback-tombstone'],
    )
    await isolatedAdapter.pool.query('ALTER TABLE inquiry_deletion_proofs ENABLE TRIGGER ALL')
    await expect(revertInquiryRetentionDeleteIntentOperation(migrationArgs)).rejects.toThrow(
      /Cannot roll back inquiry delete intents while pending operations still exist/u,
    )
    await isolatedAdapter.pool.query('DELETE FROM inquiry_deletion_proofs')
    await revertInquiryRetentionDeleteIntentOperation(migrationArgs)
    await revertInquiryRetentionPolicyEffectiveDate(migrationArgs)

    await isolatedAdapter.pool.query('ALTER TABLE inquiry_deletion_proofs DISABLE TRIGGER ALL')
    await isolatedAdapter.pool.query(
      `INSERT INTO inquiry_deletion_proofs (
         inquiry_id,
         tombstone_key,
         operation,
         reason_category,
         performed_by_id,
         performed_at,
         policy_version,
         deleted_object_count
       ) VALUES ($1, $2, 'hard-deleted', 'authorized-erasure', -1, now(), '2026-08-24', 1)`,
      ['synthetic-rollback-inquiry', 'synthetic-rollback-tombstone'],
    )
    await isolatedAdapter.pool.query('ALTER TABLE inquiry_deletion_proofs ENABLE TRIGGER ALL')

    await expect(revertInquiryRetentionActiveHoldKey(migrationArgs)).rejects.toThrow(
      /Cannot roll back inquiry retention safeguards while protected records exist/u,
    )
    const guardedState = await isolatedAdapter.pool.query<{
      active_key_column: string | null
      content_state_column: string | null
      proofs: string
    }>(
      `SELECT
         (SELECT count(*)::text FROM inquiry_deletion_proofs) AS proofs,
         (
           SELECT column_name
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'inquiry_legal_holds'
             AND column_name = 'active_key'
         ) AS active_key_column,
         (
           SELECT column_name
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'inquiry_messages'
             AND column_name = 'content_state'
         ) AS content_state_column`,
    )
    expect(guardedState.rows[0]).toEqual({
      active_key_column: 'active_key',
      content_state_column: 'content_state',
      proofs: '1',
    })
    await isolatedAdapter.pool.query('DELETE FROM inquiry_deletion_proofs')
    await revertInquiryRetentionActiveHoldKey(migrationArgs)

    await isolatedAdapter.pool.query('ALTER TABLE inquiry_deletion_proofs DISABLE TRIGGER ALL')
    await isolatedAdapter.pool.query(
      `INSERT INTO inquiry_deletion_proofs (
         inquiry_id,
         tombstone_key,
         operation,
         reason_category,
         performed_by_id,
         performed_at,
         policy_version,
         deleted_object_count
       ) VALUES ($1, $2, 'hard-deleted', 'authorized-erasure', -1, now(), '2026-08-24', 1)`,
      ['synthetic-content-state-rollback-inquiry', 'synthetic-content-state-rollback-tombstone'],
    )
    await isolatedAdapter.pool.query('ALTER TABLE inquiry_deletion_proofs ENABLE TRIGGER ALL')
    await expect(revertInquiryRetentionContentState(migrationArgs)).rejects.toThrow(
      /Cannot roll back inquiry content state while retention safeguards exist/u,
    )
    await isolatedAdapter.pool.query('DELETE FROM inquiry_deletion_proofs')

    await revertInquiryRetentionContentState(migrationArgs)
    await isolatedAdapter.pool.query('ALTER TABLE inquiry_deletion_proofs DISABLE TRIGGER ALL')
    await isolatedAdapter.pool.query(
      `INSERT INTO inquiry_deletion_proofs (
         inquiry_id,
         tombstone_key,
         operation,
         reason_category,
         performed_by_id,
         performed_at,
         policy_version,
         deleted_object_count
       ) VALUES ($1, $2, 'hard-deleted', 'authorized-erasure', -1, now(), '2026-08-24', 1)`,
      ['synthetic-foundation-rollback-inquiry', 'synthetic-foundation-rollback-tombstone'],
    )
    await isolatedAdapter.pool.query('ALTER TABLE inquiry_deletion_proofs ENABLE TRIGGER ALL')
    await expect(revertInquiryRetentionFoundation(migrationArgs)).rejects.toThrow(
      /Cannot roll back inquiry retention while deletion proofs still exist/u,
    )
    await isolatedAdapter.pool.query('DELETE FROM inquiry_deletion_proofs')
    await revertInquiryRetentionFoundation(migrationArgs)

    await isolatedAdapter.pool.query('ALTER TABLE patient_clinic_inquiries DISABLE TRIGGER ALL')
    const legacyInquiry = await isolatedAdapter.pool.query<{ id: number }>(
      `INSERT INTO patient_clinic_inquiries (
         clinic_id,
         full_name,
         email,
         phone_number,
         message,
         consent_accepted,
         status,
         handling_status,
         lifecycle,
         last_external_activity_at,
         created_at
       ) VALUES (
         -1,
         'Synthetic retained patient',
         'synthetic-retention-upgrade@example.com',
         '+493000000010',
         'Synthetic retained inquiry.',
         true,
         'submitted',
         'submitted',
         'open',
         '2024-02-29T12:00:00.000Z',
         '2024-01-31T12:00:00.000Z'
       )
       RETURNING id`,
    )
    await isolatedAdapter.pool.query('ALTER TABLE patient_clinic_inquiries ENABLE TRIGGER ALL')
    const legacyInquiryId = legacyInquiry.rows[0]?.id
    if (!legacyInquiryId) throw new Error('Expected a legacy inquiry for retention backfill.')

    await isolatedAdapter.pool.query('ALTER TABLE inquiry_moderation_cases DISABLE TRIGGER ALL')
    const legacyModerationCase = await isolatedAdapter.pool.query<{ id: number }>(
      `INSERT INTO inquiry_moderation_cases (
         inquiry_id,
         clinic_id,
         patient_id,
         conversation_id,
         target_type,
         target_id,
         reporter_kind,
         reporter_key,
         category,
         idempotency_key,
         request_hash,
         status,
         final_outcome_at,
         measure_ended_at
       ) VALUES (
         $1,
         -1,
         -1,
         -1,
         'conversation',
         'synthetic-retention-upgrade-conversation',
         'patient',
         'synthetic-retention-upgrade-reporter',
         'other',
         'synthetic-retention-upgrade-key',
         'synthetic-retention-upgrade-hash',
         'resolved',
         '2024-03-15T12:00:00.000Z',
         '2024-04-01T12:00:00.000Z'
       )
       RETURNING id`,
      [legacyInquiryId],
    )
    await isolatedAdapter.pool.query('ALTER TABLE inquiry_moderation_cases ENABLE TRIGGER ALL')
    const legacyModerationCaseId = legacyModerationCase.rows[0]?.id
    if (!legacyModerationCaseId) throw new Error('Expected a legacy moderation case for retention backfill.')

    const afterDown = await isolatedAdapter.pool.query<{
      communication_table: string | null
      content_state_column: string | null
      retention_column: string | null
      retention_policies: string | null
    }>(
      `SELECT
         to_regclass('public.inquiry_conversations')::text AS communication_table,
         to_regclass('public.inquiry_retention_policies')::text AS retention_policies,
         (
           SELECT column_name
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'patient_clinic_inquiries'
             AND column_name = 'retention_policy_version'
         ) AS retention_column,
         (
           SELECT column_name
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'inquiry_messages'
             AND column_name = 'content_state'
         ) AS content_state_column`,
    )
    expect(afterDown.rows[0]).toEqual({
      communication_table: 'inquiry_conversations',
      content_state_column: null,
      retention_column: null,
      retention_policies: null,
    })

    await applyInquiryRetentionFoundation(migrationArgs)
    await applyInquiryRetentionContentState(migrationArgs)
    await applyInquiryRetentionActiveHoldKey(migrationArgs)
    await applyInquiryRetentionPolicyEffectiveDate(migrationArgs)
    await applyInquiryRetentionDeleteIntentOperation(migrationArgs)

    const afterUp = await isolatedAdapter.pool.query<{
      communication_review_months: string
      moderation_review_months: string
      policy_key: string
      version: string
    }>(
      `SELECT policy_key, version, communication_review_months, moderation_review_months
       FROM inquiry_retention_policies
       WHERE policy_key = 'inquiry-communication'
         AND version = '2026-08-24'`,
    )
    expect(afterUp.rows).toEqual([
      {
        communication_review_months: '12',
        moderation_review_months: '24',
        policy_key: 'inquiry-communication',
        version: '2026-08-24',
      },
    ])

    const inquiryBackfill = await isolatedAdapter.pool.query<{
      retention_policy_version: string | null
      retention_review_basis_at: Date | null
      retention_review_due_at: Date | null
    }>(
      `SELECT retention_policy_version, retention_review_basis_at, retention_review_due_at
       FROM patient_clinic_inquiries
       WHERE id = $1`,
      [legacyInquiryId],
    )
    expect(inquiryBackfill.rows[0]).toMatchObject({ retention_policy_version: '2026-08-24' })
    expect(inquiryBackfill.rows[0]?.retention_review_basis_at?.toISOString()).toBe('2024-02-29T12:00:00.000Z')
    expect(inquiryBackfill.rows[0]?.retention_review_due_at?.toISOString()).toBe('2025-02-28T12:00:00.000Z')

    const moderationBackfill = await isolatedAdapter.pool.query<{
      retention_policy_version: string | null
      retention_review_due_at: Date | null
    }>(
      `SELECT retention_policy_version, retention_review_due_at
       FROM inquiry_moderation_cases
       WHERE id = $1`,
      [legacyModerationCaseId],
    )
    expect(moderationBackfill.rows[0]).toMatchObject({ retention_policy_version: '2026-08-24' })
    expect(moderationBackfill.rows[0]?.retention_review_due_at?.toISOString()).toBe('2026-04-01T12:00:00.000Z')

    const restoredColumns = await isolatedAdapter.pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (
           (table_name = 'patient_clinic_inquiries' AND column_name = 'retention_policy_version')
           OR (table_name = 'inquiry_messages' AND column_name = 'content_state')
         )
       ORDER BY column_name`,
    )
    expect(restoredColumns.rows).toEqual([
      { column_name: 'content_state' },
      { column_name: 'retention_policy_version' },
    ])
  })
})
