import { describe, expect, it, vi } from 'vitest'

import { down, up } from '@/migrations/20260730_121845_clinic_postal_code_price_contract'

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

describe('clinics and clinictreatments postal code and EUR price migration', () => {
  it('casts numeric postal codes directly and normalizes every legacy price to cents', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)

    await up({
      db: { execute },
      payload: {},
      req: {},
    } as never)

    expect(execute).toHaveBeenCalledTimes(1)
    const sqlText = extractSql(execute.mock.calls[0]?.[0])

    expect(sqlText).toContain('USING "address_zip_code"::text')
    expect(sqlText).toContain('ROUND(GREATEST("price", 0), 2)')
    expect(sqlText).toContain('"price" < 0')
    expect(sqlText).toContain('"price" <> ROUND("price", 2)')
  })

  it.each([
    [6420, '6420'],
    [null, null],
  ])('preserves legacy postal code %s as %s', (legacyValue, expected) => {
    expect(legacyValue === null ? null : String(legacyValue)).toBe(expected)
  })

  it.each([
    [12.345, 12.35],
    [12.344, 12.34],
    [-1.25, 0],
    [0, 0],
    [12.34, 12.34],
  ])('normalizes legacy EUR price %s to %s', (legacyValue, expected) => {
    const normalized = Math.round((Math.max(legacyValue, 0) + Number.EPSILON) * 100) / 100
    expect(normalized).toBe(expected)
  })

  it('blocks the lossy rollback', async () => {
    await expect(down({} as never)).rejects.toThrow('forward-only')
  })
})
