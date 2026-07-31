import { describe, expect, it, vi } from 'vitest'

import { down, up } from '@/migrations/20260730_201810_clinics_turkiye_country_relationship'

type SqlChunk = {
  queryChunks?: unknown[]
  value?: unknown
}

const extractSql = (chunk: unknown): string => {
  if (typeof chunk === 'string') return chunk
  if (Array.isArray(chunk)) return chunk.map(extractSql).join('')
  if (!chunk || typeof chunk !== 'object') return ''

  const sqlChunk = chunk as SqlChunk
  if (Array.isArray(sqlChunk.value)) return sqlChunk.value.map(extractSql).join('')
  if (Array.isArray(sqlChunk.queryChunks)) return sqlChunk.queryChunks.map(extractSql).join('')

  return ''
}

describe('clinic country relationship migration', () => {
  it('normalizes supported legacy country spellings and rejects every unmapped non-empty value', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)

    await up({
      db: { execute },
      payload: {},
      req: {},
    } as never)

    expect(execute).toHaveBeenCalledTimes(1)
    const sqlText = extractSql(execute.mock.calls[0]?.[0])
    const addClinicCountryIndex = sqlText.indexOf('ADD COLUMN "address_country_id" integer')
    const clinicBackfillIndex = sqlText.indexOf('UPDATE "clinics"')
    const clinicConstraintIndex = sqlText.indexOf('ADD CONSTRAINT "clinics_address_country_id_countries_id_fk"')

    expect(addClinicCountryIndex).toBeGreaterThanOrEqual(0)
    expect(clinicBackfillIndex).toBeGreaterThan(addClinicCountryIndex)
    expect(clinicConstraintIndex).toBeGreaterThan(clinicBackfillIndex)
    expect(sqlText).toContain('UPPER(BTRIM("iso_code")) = \'TR\'')
    expect(sqlText).toContain("RAISE EXCEPTION 'Expected exactly one Countries record with ISO TR'")
    expect(sqlText).toMatch(/EXISTS \(\s+SELECT 1\s+FROM "clinics"/)
    expect(sqlText).toMatch(/OR EXISTS \(\s+SELECT 1\s+FROM "search"/)
    expect(sqlText).toContain('"name" = \'Türkiye\'')
    expect(sqlText).toContain('"iso_code" = \'TR\'')
    expect(sqlText).toContain('LOWER(BTRIM("clinics"."address_country")) IN (\'turkey\', \'türkiye\')')
    expect(sqlText).toContain('"address_country" = \'Türkiye\'')
    expect(sqlText).toContain('"clinics"."address_country_id" IS NULL')
    expect(sqlText).toContain('UPDATE "search"')
    expect(sqlText).toContain('LOWER(BTRIM("search"."country")) IN (\'turkey\', \'türkiye\')')
    expect(sqlText).toContain('"country" = \'Türkiye\'')
    expect(sqlText).toContain('ALTER TABLE "clinics" ALTER COLUMN "address_country" SET DEFAULT \'Türkiye\'')
    expect(sqlText).toContain('ALTER TABLE "search" ALTER COLUMN "country" SET DEFAULT \'Türkiye\'')
    expect(sqlText).toContain('"search"."country_id" IS NULL')
    expect(sqlText).toContain('NULLIF(BTRIM("address_country"), \'\') IS NOT NULL')
    expect(sqlText).toContain('NULLIF(BTRIM("country"), \'\') IS NOT NULL')
    expect(sqlText).toContain(
      "RAISE EXCEPTION 'Cannot map one or more clinic legacy country values to Countries ISO TR'",
    )
    expect(sqlText).toContain(
      "RAISE EXCEPTION 'Cannot map one or more search legacy country values to Countries ISO TR'",
    )
    expect(sqlText).not.toContain('DROP COLUMN "address_country"')
    expect(sqlText).not.toContain('DROP COLUMN "country"')
    expect(sqlText).not.toContain('"address_street"')
    expect(sqlText).not.toContain('"address_house_number"')
    expect(sqlText).not.toContain('"address_zip_code"')
  })

  it('restores legacy defaults and removes only the replacement relationship columns on rollback', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)

    await down({
      db: { execute },
      payload: {},
      req: {},
    } as never)

    const sqlText = extractSql(execute.mock.calls[0]?.[0])

    expect(sqlText).toContain('DROP COLUMN "address_country_id"')
    expect(sqlText).toContain('DROP COLUMN "country_id"')
    expect(sqlText).toContain('ALTER TABLE "clinics" ALTER COLUMN "address_country" SET DEFAULT \'Turkey\'')
    expect(sqlText).toContain('ALTER TABLE "search" ALTER COLUMN "country" SET DEFAULT \'Turkey\'')
    expect(sqlText).not.toContain('ADD COLUMN "address_country"')
    expect(sqlText).not.toContain('ADD COLUMN "country"')
  })
})
