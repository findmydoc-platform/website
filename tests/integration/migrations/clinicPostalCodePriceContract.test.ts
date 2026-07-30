import { Client } from 'pg'
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

  it('migrates legacy postal codes and EUR prices in PostgreSQL', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URI })
    await client.connect()

    try {
      await client.query('BEGIN')
      await client.query('CREATE TEMP TABLE clinics (id integer, address_zip_code numeric)')
      await client.query('CREATE TEMP TABLE clinictreatments (id integer, price numeric)')
      await client.query(`INSERT INTO clinics (id, address_zip_code) VALUES (1, 6420), (2, NULL)`)
      await client.query(`
        INSERT INTO clinictreatments (id, price)
        VALUES (1, 12.345), (2, 12.344), (3, -1.25), (4, 0), (5, 12.34), (6, NULL)
      `)

      await up({
        db: {
          execute: (statement: unknown) => client.query(extractSql(statement)),
        },
        payload: {},
        req: {},
      } as never)

      const postalCodes = await client.query<{
        address_zip_code: string | null
        id: number
      }>('SELECT id, address_zip_code FROM clinics ORDER BY id')
      expect(postalCodes.rows).toEqual([
        { address_zip_code: '6420', id: 1 },
        { address_zip_code: null, id: 2 },
      ])

      const prices = await client.query<{ id: number; price: string | null }>(
        'SELECT id, price FROM clinictreatments ORDER BY id',
      )
      expect(prices.rows.map(({ id, price }) => ({ id, price: price === null ? null : Number(price) }))).toEqual([
        { id: 1, price: 12.35 },
        { id: 2, price: 12.34 },
        { id: 3, price: 0 },
        { id: 4, price: 0 },
        { id: 5, price: 12.34 },
        { id: 6, price: null },
      ])
    } finally {
      await client.query('ROLLBACK').catch(() => undefined)
      await client.end()
    }
  })

  it('blocks the lossy rollback', async () => {
    await expect(down({} as never)).rejects.toThrow('forward-only')
  })
})
