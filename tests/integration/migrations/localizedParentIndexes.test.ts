import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { drizzle, type NodePgClient } from '@payloadcms/db-postgres/drizzle/node-postgres'
import { describe, expect, it } from 'vitest'
import { up, down } from '@/migrations/20261111_092853_align_localized_parent_indexes'
import { deriveDatabaseConfig } from '../../../scripts/test-database-harness.mjs'

describe('localized parent index migration', () => {
  it('adds the generated indexes and rolls them back while preserving localized rows', async () => {
    const { connectionString } = deriveDatabaseConfig(process.env.DATABASE_URI)
    const client = new Client({ connectionString })
    await client.connect()
    const db = drizzle(client as unknown as NodePgClient)
    const schema = `locale_indexes_${randomUUID().replaceAll('-', '')}`
    const tables = ['pages_locales', '_pages_v_locales', 'posts_locales', '_posts_v_locales']
    try {
      await client.query(`BEGIN; CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}";`)
      for (const table of tables) {
        await client.query(
          `CREATE TABLE "${table}" (_parent_id integer, title text); INSERT INTO "${table}" VALUES (1, 'Keep this translation')`,
        )
      }
      await up({ db } as unknown as Parameters<typeof up>[0])
      const indexes = await client.query(
        'SELECT tablename, indexdef FROM pg_indexes WHERE schemaname = $1 ORDER BY tablename',
        [schema],
      )
      expect(indexes.rows).toEqual(
        [...tables].sort().map((table) => ({
          tablename: table,
          indexdef: `CREATE INDEX ${table}_parent_id_idx ON ${schema}.${table} USING btree (_parent_id)`,
        })),
      )
      await down({ db } as unknown as Parameters<typeof down>[0])
      expect((await client.query('SELECT indexname FROM pg_indexes WHERE schemaname = $1', [schema])).rows).toEqual([])
      for (const table of tables) {
        expect((await client.query(`SELECT * FROM "${table}"`)).rows).toEqual([
          { _parent_id: 1, title: 'Keep this translation' },
        ])
      }
    } finally {
      await client.query('ROLLBACK')
      await client.end()
    }
  })
})
