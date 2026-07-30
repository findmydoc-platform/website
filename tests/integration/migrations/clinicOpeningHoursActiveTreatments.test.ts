import { describe, expect, it, vi } from 'vitest'

import { up } from '@/migrations/20260728_225058_clinic_opening_hours_active_treatments'

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

describe('clinics and clinictreatments schema migration', () => {
  it('adds nullable opening hours before backfilling active offerings without touching prices', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)

    await up({
      db: { execute },
      payload: {},
      req: {},
    } as never)

    expect(execute).toHaveBeenCalledTimes(1)
    const sqlText = extractSql(execute.mock.calls[0]?.[0])

    for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
      expect(sqlText).toContain(`\"opening_hours_${day}_is_closed\" boolean`)
      expect(sqlText).toContain(`\"opening_hours_${day}_opens_at\" varchar`)
      expect(sqlText).toContain(`\"opening_hours_${day}_closes_at\" varchar`)
    }

    const addActiveIndex = sqlText.indexOf('ALTER TABLE "clinictreatments" ADD COLUMN "active" boolean')
    const backfillIndex = sqlText.indexOf('UPDATE "clinictreatments"')
    const hardenIndex = sqlText.indexOf('ALTER COLUMN "active" SET DEFAULT false')

    expect(addActiveIndex).toBeGreaterThanOrEqual(0)
    expect(backfillIndex).toBeGreaterThan(addActiveIndex)
    expect(hardenIndex).toBeGreaterThan(backfillIndex)
    expect(sqlText).toContain('SET "active" = true')
    expect(sqlText).toContain('WHERE "active" IS NULL')
    expect(sqlText).toContain('ALTER COLUMN "active" SET NOT NULL')

    const backfillStatement = sqlText.match(/UPDATE "clinictreatments"[\s\S]*?;/u)?.[0]
    expect(backfillStatement).toBeDefined()
    expect(backfillStatement).not.toContain('"price"')
  })
})
