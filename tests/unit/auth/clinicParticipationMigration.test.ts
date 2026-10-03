import { describe, expect, it, vi } from 'vitest'
import { PgDialect } from '@payloadcms/db-postgres/drizzle/pg-core'
import type { MigrateUpArgs } from '@payloadcms/db-postgres'
import { up } from '@/migrations/20261003_075837_clinic_participation_completion'

describe('historical clinic participation backfill', () => {
  it('uses only its installed schema and does not invoke future runtime collections', async () => {
    const queries: string[] = []
    const dialect = new PgDialect()
    const payload = { find: vi.fn(), update: vi.fn() }
    await up({
      db: {
        execute: async (query: Parameters<typeof dialect.sqlToQuery>[0]) => queries.push(dialect.sqlToQuery(query).sql),
      },
      payload,
      req: { payload },
    } as unknown as MigrateUpArgs)
    expect(queries).toHaveLength(2)
    const backfill = queries[1]!
    expect(backfill).toContain('staff."legacy_access_eligible_at" IS NULL')
    expect(backfill).toContain('staff."status" = \'approved\'')
    expect(backfill).toContain('staff."auth_sync_status" = \'synced\'')
    expect(backfill).toContain('staff."supabase_user_id" IS NOT NULL')
    expect(backfill).toContain('clinic."status" = \'approved\'')
    expect(backfill).toContain('clinic."deleted_at" IS NULL')
    expect(backfill).toContain('count(*) = 1')
    expect(backfill).toContain('application."provisioning_status" = \'completed\'')
    expect(backfill).toContain('application."linked_records_clinic_staff_id" = staff."id"')
    expect(backfill).toContain('application."linked_records_clinic_id" = clinic."id"')
    expect(backfill).toContain('bool_and(staff."onboarding_key" = \'clinic-application:\' || application."id"::text)')
    expect(backfill).toContain('clinic."onboarding_key" = staff."onboarding_key"')
    expect(backfill).not.toContain('invitation_authorized_at')
    expect(backfill).not.toContain('account_completion')
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })
})
