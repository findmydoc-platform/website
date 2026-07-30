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
  it('adds relationship columns and maps Turkey to ISO TR without dropping legacy text columns', async () => {
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
    expect(sqlText).toContain('"clinics"."address_country" = \'Turkey\'')
    expect(sqlText).toContain('"clinics"."address_country_id" IS NULL')
    expect(sqlText).toContain('UPDATE "search"')
    expect(sqlText).toContain('"search"."country" = \'Turkey\'')
    expect(sqlText).toContain('"search"."country_id" IS NULL')
    expect(sqlText).toContain("RAISE EXCEPTION 'Cannot map clinic country Turkey to Countries ISO TR'")
    expect(sqlText).not.toContain('DROP COLUMN "address_country"')
    expect(sqlText).not.toContain('DROP COLUMN "country"')
    expect(sqlText).not.toContain('"address_street"')
    expect(sqlText).not.toContain('"address_house_number"')
    expect(sqlText).not.toContain('"address_zip_code"')
  })

  it('removes only the replacement relationship columns on rollback', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)

    await down({
      db: { execute },
      payload: {},
      req: {},
    } as never)

    const sqlText = extractSql(execute.mock.calls[0]?.[0])

    expect(sqlText).toContain('DROP COLUMN "address_country_id"')
    expect(sqlText).toContain('DROP COLUMN "country_id"')
    expect(sqlText).not.toContain('ADD COLUMN "address_country"')
    expect(sqlText).not.toContain('ADD COLUMN "country"')
  })
})
