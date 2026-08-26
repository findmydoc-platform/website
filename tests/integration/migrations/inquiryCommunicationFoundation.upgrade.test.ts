import { randomUUID } from 'node:crypto'

import { postgresAdapter } from '@payloadcms/db-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createLocalReq, getPayload, type Payload } from 'payload'

import config from '@payload-config'
import {
  down as revertInquiryCommunicationFoundation,
  up as applyInquiryCommunicationFoundation,
} from '@/migrations/20260824_135226_inquiry_communication_foundation'
import { deriveDatabaseConfig } from '../../../scripts/test-database-harness.mjs'

const { Client } = pg

const NEW_INQUIRY_COLUMNS = [
  'activity_sequence',
  'clinic_notification_sequence',
  'clinic_unread_epoch',
  'clinic_unread_floor',
  'creation_actor_key',
  'creation_idempotency_key',
  'creation_request_hash',
  'deleted_at',
  'external_sequence',
  'handling_status',
  'last_activity_at',
  'last_external_activity_at',
  'lifecycle',
  'patient_id',
  'previous_handling_status',
  'revision',
] as const

const NEW_TABLES = [
  'inquiry_attachments',
  'inquiry_audit_events',
  'inquiry_conversations',
  'inquiry_internal_notes',
  'inquiry_messages',
  'inquiry_read_positions',
] as const

const LOCKED_DOCUMENT_REL_COLUMNS = [
  'inquiry_attachments_id',
  'inquiry_audit_events_id',
  'inquiry_conversations_id',
  'inquiry_internal_notes_id',
  'inquiry_messages_id',
  'inquiry_read_positions_id',
] as const

const NEW_ENUM_TYPES = [
  'enum_inquiry_attachments_declared_mime_type',
  'enum_inquiry_attachments_owner_kind',
  'enum_inquiry_attachments_state',
  'enum_inquiry_attachments_verified_mime_type',
  'enum_inquiry_audit_events_actor_kind',
  'enum_inquiry_audit_events_event_type',
  'enum_inquiry_messages_author_kind',
  'enum_inquiry_read_positions_reader_kind',
  'enum_patient_clinic_inquiries_handling_status',
  'enum_patient_clinic_inquiries_lifecycle',
  'enum_patient_clinic_inquiries_previous_handling_status',
] as const

const REQUIRED_INDEXES = [
  'inquiry_actorKey_idempotencyKey_1_idx',
  'inquiry_actorKey_idempotencyKey_idx',
  'inquiry_attachments_bound_message_idx',
  'inquiry_attachments_inquiry_idx',
  'inquiry_audit_events_event_type_idx',
  'inquiry_conversations_inquiry_idx',
  'inquiry_messages_inquiry_idx',
  'inquiry_internal_notes_inquiry_idx',
  'inquiry_readerKey_idx',
  'inquiry_read_positions_inquiry_idx',
  'patient_clinic_inquiries_handling_status_idx',
  'patient_clinic_inquiries_lifecycle_idx',
  'patient_clinic_inquiries_patient_idx',
  'patient_creationIdempotencyKey_idx',
] as const

type IsolatedAdapter = ReturnType<ReturnType<typeof postgresAdapter>['init']>
type RetainedPoolClient = { release: (destroy?: boolean) => void }

const isLowercaseAlphaNumeric = (value: string): boolean =>
  (value >= 'a' && value <= 'z') || (value >= '0' && value <= '9')

const quotedTestDatabaseIdentifier = (value: string): string => {
  const suffix = value.slice('findmydoc-test'.length)
  const hasSafePrefix = value.startsWith('findmydoc-test')
  const hasSafeSuffixStart =
    suffix.length >= 2 && (suffix[0] === '-' || suffix[0] === '_') && isLowercaseAlphaNumeric(suffix[1] ?? '')
  const hasOnlySafeSuffixCharacters = [...suffix.slice(2)].every(
    (character) => isLowercaseAlphaNumeric(character) || character === '-' || character === '_',
  )

  if (!hasSafePrefix || !hasSafeSuffixStart || !hasOnlySafeSuffixCharacters || value.length > 63) {
    throw new Error(`Unsafe isolated migration database name: ${value}`)
  }
  return `"${value}"`
}

const quotedNewTableIdentifier = (value: (typeof NEW_TABLES)[number]): string => {
  if (!NEW_TABLES.includes(value)) throw new Error(`Unexpected inquiry communication table: ${value}`)
  return `"${value}"`
}

const restoreImmediatelyPreviousSchema = async (adapter: IsolatedAdapter): Promise<void> => {
  await adapter.pool.query(`
    DROP TABLE IF EXISTS inquiry_conversations CASCADE;
    DROP TABLE IF EXISTS inquiry_messages CASCADE;
    DROP TABLE IF EXISTS inquiry_internal_notes CASCADE;
    DROP TABLE IF EXISTS inquiry_attachments CASCADE;
    DROP TABLE IF EXISTS inquiry_read_positions CASCADE;
    DROP TABLE IF EXISTS inquiry_audit_events CASCADE;

    ALTER TABLE patient_clinic_inquiries DROP COLUMN IF EXISTS patient_id CASCADE;
    ALTER TABLE patient_clinic_inquiries DROP COLUMN IF EXISTS handling_status CASCADE;
    ALTER TABLE patient_clinic_inquiries DROP COLUMN IF EXISTS lifecycle CASCADE;
    ALTER TABLE patient_clinic_inquiries DROP COLUMN IF EXISTS previous_handling_status CASCADE;
    ALTER TABLE patient_clinic_inquiries DROP COLUMN IF EXISTS revision CASCADE;
    ALTER TABLE patient_clinic_inquiries DROP COLUMN IF EXISTS activity_sequence CASCADE;
    ALTER TABLE patient_clinic_inquiries DROP COLUMN IF EXISTS external_sequence CASCADE;
    ALTER TABLE patient_clinic_inquiries DROP COLUMN IF EXISTS clinic_notification_sequence CASCADE;
    ALTER TABLE patient_clinic_inquiries DROP COLUMN IF EXISTS clinic_unread_floor CASCADE;
    ALTER TABLE patient_clinic_inquiries DROP COLUMN IF EXISTS clinic_unread_epoch CASCADE;
    ALTER TABLE patient_clinic_inquiries DROP COLUMN IF EXISTS last_activity_at CASCADE;
    ALTER TABLE patient_clinic_inquiries DROP COLUMN IF EXISTS last_external_activity_at CASCADE;
    ALTER TABLE patient_clinic_inquiries DROP COLUMN IF EXISTS creation_actor_key CASCADE;
    ALTER TABLE patient_clinic_inquiries DROP COLUMN IF EXISTS creation_idempotency_key CASCADE;
    ALTER TABLE patient_clinic_inquiries DROP COLUMN IF EXISTS creation_request_hash CASCADE;
    ALTER TABLE patient_clinic_inquiries DROP COLUMN IF EXISTS deleted_at CASCADE;

    ALTER TABLE payload_locked_documents_rels DROP COLUMN IF EXISTS inquiry_conversations_id CASCADE;
    ALTER TABLE payload_locked_documents_rels DROP COLUMN IF EXISTS inquiry_messages_id CASCADE;
    ALTER TABLE payload_locked_documents_rels DROP COLUMN IF EXISTS inquiry_internal_notes_id CASCADE;
    ALTER TABLE payload_locked_documents_rels DROP COLUMN IF EXISTS inquiry_attachments_id CASCADE;
    ALTER TABLE payload_locked_documents_rels DROP COLUMN IF EXISTS inquiry_read_positions_id CASCADE;
    ALTER TABLE payload_locked_documents_rels DROP COLUMN IF EXISTS inquiry_audit_events_id CASCADE;

    DROP TYPE IF EXISTS enum_patient_clinic_inquiries_handling_status CASCADE;
    DROP TYPE IF EXISTS enum_patient_clinic_inquiries_lifecycle CASCADE;
    DROP TYPE IF EXISTS enum_patient_clinic_inquiries_previous_handling_status CASCADE;
    DROP TYPE IF EXISTS enum_inquiry_messages_author_kind CASCADE;
    DROP TYPE IF EXISTS enum_inquiry_attachments_owner_kind CASCADE;
    DROP TYPE IF EXISTS enum_inquiry_attachments_declared_mime_type CASCADE;
    DROP TYPE IF EXISTS enum_inquiry_attachments_verified_mime_type CASCADE;
    DROP TYPE IF EXISTS enum_inquiry_attachments_state CASCADE;
    DROP TYPE IF EXISTS enum_inquiry_read_positions_reader_kind CASCADE;
    DROP TYPE IF EXISTS enum_inquiry_audit_events_actor_kind CASCADE;
    DROP TYPE IF EXISTS enum_inquiry_audit_events_event_type CASCADE;
  `)
}

describe('inquiry communication foundation upgrade migration', () => {
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

    await restoreImmediatelyPreviousSchema(isolatedAdapter)
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

  it('preserves submitted, closed, and spam legacy rows while adding nullable communication storage', async () => {
    const columnsBefore = await isolatedAdapter.pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'patient_clinic_inquiries'
         AND column_name = ANY($1::text[])
       ORDER BY column_name`,
      [[...NEW_INQUIRY_COLUMNS]],
    )
    expect(columnsBefore.rows).toEqual([])
    const tablesBefore = await isolatedAdapter.pool.query<{ tablename: string }>(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename = ANY($1::text[])
       ORDER BY tablename`,
      [[...NEW_TABLES]],
    )
    expect(tablesBefore.rows).toEqual([])

    const country = await isolatedAdapter.pool.query<{ id: number }>(
      `INSERT INTO countries (name, iso_code, language, currency)
       VALUES ('Synthetic Migration Country', 'SM', 'English', 'EUR')
       RETURNING id`,
    )
    const countryId = country.rows[0]?.id
    if (!countryId) throw new Error('Expected the isolated migration country.')
    const city = await isolatedAdapter.pool.query<{ id: number }>(
      `INSERT INTO cities (name, coordinates, country_id)
       VALUES ('Synthetic Migration City', ST_SetSRID(ST_MakePoint(8.0, 50.0), 4326), $1)
       RETURNING id`,
      [countryId],
    )
    const cityId = city.rows[0]?.id
    if (!cityId) throw new Error('Expected the isolated migration city.')
    const clinic = await isolatedAdapter.pool.query<{ id: number }>(
      `INSERT INTO clinics (
         name,
         address_country,
         address_country_id,
         address_street,
         address_house_number,
         address_zip_code,
         address_city_id,
         contact_phone_number,
         contact_email,
         status,
         slug
       ) VALUES (
         'Synthetic Migration Clinic',
         'Synthetic Migration Country',
         $1,
         'Migration Street',
         '1',
         12345,
         $2,
         '+493000000044',
         'migration-clinic@example.com',
         'approved',
         'synthetic-migration-clinic'
       ) RETURNING id`,
      [countryId, cityId],
    )
    const clinicId = clinic.rows[0]?.id
    if (!clinicId) throw new Error('Expected the isolated migration clinic.')

    const legacyRows = [
      {
        email: 'legacy-submitted@example.com',
        fullName: 'Legacy Submitted',
        message: 'Synthetic legacy submitted inquiry.',
        phoneNumber: '+493000000045',
        status: 'submitted',
      },
      {
        email: 'legacy-closed@example.com',
        fullName: 'Legacy Closed',
        message: 'Synthetic legacy closed inquiry.',
        phoneNumber: '+493000000046',
        status: 'closed',
      },
      {
        email: 'legacy-spam@example.com',
        fullName: 'Legacy Spam',
        message: 'Synthetic legacy spam inquiry.',
        phoneNumber: '+493000000047',
        status: 'spam',
      },
    ] as const

    for (const row of legacyRows) {
      await isolatedAdapter.pool.query(
        `INSERT INTO patient_clinic_inquiries (
           clinic_id,
           full_name,
           email,
           phone_number,
           message,
           consent_accepted,
           consent_accepted_at,
           consent_text,
           status
         ) VALUES ($1, $2, $3, $4, $5, true, '2026-08-24T10:00:00.000Z', 'Synthetic migration consent.', $6)`,
        [clinicId, row.fullName, row.email, row.phoneNumber, row.message, row.status],
      )
    }

    const legacySnapshot = await isolatedAdapter.pool.query<{
      email: string
      full_name: string
      id: number
      message: string
      phone_number: string
      status: string
    }>(
      `SELECT id, full_name, email, phone_number, message, status
       FROM patient_clinic_inquiries
       ORDER BY id`,
    )
    expect(legacySnapshot.rows).toHaveLength(3)

    const req = await createLocalReq({}, payload)
    await applyInquiryCommunicationFoundation({
      db: isolatedAdapter.drizzle,
      payload,
      req,
    } as never)

    const rowsAfter = await isolatedAdapter.pool.query<{
      activity_sequence: null
      clinic_notification_sequence: null
      clinic_unread_epoch: null
      clinic_unread_floor: null
      creation_actor_key: null
      creation_idempotency_key: null
      creation_request_hash: null
      deleted_at: null
      email: string
      external_sequence: null
      full_name: string
      handling_status: null
      id: number
      last_activity_at: null
      last_external_activity_at: null
      lifecycle: null
      message: string
      patient_id: null
      phone_number: string
      previous_handling_status: null
      revision: null
      status: string
    }>(
      `SELECT
         id,
         full_name,
         email,
         phone_number,
         message,
         status,
         patient_id,
         handling_status,
         lifecycle,
         previous_handling_status,
         revision,
         activity_sequence,
         external_sequence,
         clinic_notification_sequence,
         clinic_unread_floor,
         clinic_unread_epoch,
         last_activity_at,
         last_external_activity_at,
         creation_actor_key,
         creation_idempotency_key,
         creation_request_hash,
         deleted_at
       FROM patient_clinic_inquiries
       ORDER BY id`,
    )
    expect(
      rowsAfter.rows.map(({ email, full_name, id, message, phone_number, status }) => ({
        email,
        full_name,
        id,
        message,
        phone_number,
        status,
      })),
    ).toEqual(legacySnapshot.rows)
    for (const row of rowsAfter.rows) {
      for (const column of NEW_INQUIRY_COLUMNS) {
        expect(row[column]).toBeNull()
      }
    }

    const tables = await isolatedAdapter.pool.query<{ tablename: string }>(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename = ANY($1::text[])
       ORDER BY tablename`,
      [[...NEW_TABLES]],
    )
    expect(tables.rows.map((row) => row.tablename)).toEqual([...NEW_TABLES].sort())

    const indexes = await isolatedAdapter.pool.query<{ indexname: string }>(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = ANY($1::text[])
       ORDER BY indexname`,
      [[...REQUIRED_INDEXES]],
    )
    expect(indexes.rows.map((row) => row.indexname)).toEqual([...REQUIRED_INDEXES].sort())

    for (const table of NEW_TABLES) {
      const count = await isolatedAdapter.pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${quotedNewTableIdentifier(table)}`,
      )
      expect(count.rows[0]?.count).toBe('0')
    }

    await revertInquiryCommunicationFoundation({
      db: isolatedAdapter.drizzle,
      payload,
      req,
    } as never)

    const columnsAfterDown = await isolatedAdapter.pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'patient_clinic_inquiries'
         AND column_name = ANY($1::text[])
       ORDER BY column_name`,
      [[...NEW_INQUIRY_COLUMNS]],
    )
    expect(columnsAfterDown.rows).toEqual([])

    const lockedRelationColumnsAfterDown = await isolatedAdapter.pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'payload_locked_documents_rels'
         AND column_name = ANY($1::text[])
       ORDER BY column_name`,
      [[...LOCKED_DOCUMENT_REL_COLUMNS]],
    )
    expect(lockedRelationColumnsAfterDown.rows).toEqual([])

    const tablesAfterDown = await isolatedAdapter.pool.query<{ tablename: string }>(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename = ANY($1::text[])
       ORDER BY tablename`,
      [[...NEW_TABLES]],
    )
    expect(tablesAfterDown.rows).toEqual([])

    const enumTypesAfterDown = await isolatedAdapter.pool.query<{ typname: string }>(
      `SELECT typname
       FROM pg_type
       WHERE typname = ANY($1::text[])
       ORDER BY typname`,
      [[...NEW_ENUM_TYPES]],
    )
    expect(enumTypesAfterDown.rows).toEqual([])

    const legacyRowsAfterDown = await isolatedAdapter.pool.query<{
      email: string
      full_name: string
      id: number
      message: string
      phone_number: string
      status: string
    }>(
      `SELECT id, full_name, email, phone_number, message, status
       FROM patient_clinic_inquiries
       ORDER BY id`,
    )
    expect(legacyRowsAfterDown.rows).toEqual(legacySnapshot.rows)
  }, 60_000)
})
