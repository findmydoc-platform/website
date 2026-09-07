import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { drizzle, type NodePgClient } from '@payloadcms/db-postgres/drizzle/node-postgres'
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { up, down } from '@/migrations/20260907_092854_remove_search_contract'
import { deriveDatabaseConfig } from '../../../scripts/test-database-harness.mjs'

describe('retired search storage contract', () => {
  let client: Client
  let db: ReturnType<typeof drizzle>

  beforeEach(async () => {
    const { connectionString } = deriveDatabaseConfig(process.env.DATABASE_URI)
    client = new Client({ connectionString })
    await client.connect()
    // Payload pins older pg declarations; both clients expose the same runtime query interface.
    db = drizzle(client as unknown as NodePgClient)
    const schema = `search_contract_${randomUUID().replaceAll('-', '')}`
    await client.query(`BEGIN; CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}";`)
    await client.query(`
      CREATE TABLE posts (id integer PRIMARY KEY, title text);
      CREATE TABLE categories (id integer PRIMARY KEY, title text);
      CREATE TABLE platform_content_media (id integer PRIMARY KEY, filename text);
      INSERT INTO posts VALUES (1, 'Keep the original post');
      INSERT INTO categories VALUES (1, 'Keep the category');
      INSERT INTO platform_content_media VALUES (1, 'keep.png');
      CREATE TABLE search (id serial PRIMARY KEY, title text);
      CREATE TABLE search_categories (id varchar PRIMARY KEY, _parent_id integer REFERENCES search(id));
      CREATE TABLE search_rels (id serial PRIMARY KEY, parent_id integer REFERENCES search(id), posts_id integer REFERENCES posts(id));
      INSERT INTO search VALUES (1, 'Derived article');
      INSERT INTO search_categories VALUES ('category-row', 1);
      INSERT INTO search_rels VALUES (1, 1, 1);
      CREATE TABLE payload_locked_documents (id integer PRIMARY KEY, global_slug varchar);
      CREATE TABLE payload_locked_documents_rels (
        id integer PRIMARY KEY, parent_id integer REFERENCES payload_locked_documents(id) ON DELETE CASCADE,
        "order" integer, path varchar, search_id integer, posts_id integer REFERENCES posts(id),
        CONSTRAINT payload_locked_documents_rels_search_fk FOREIGN KEY (search_id) REFERENCES search(id)
      );
      CREATE INDEX payload_locked_documents_rels_search_id_idx ON payload_locked_documents_rels(search_id);
      INSERT INTO payload_locked_documents VALUES (1, NULL), (2, NULL), (3, NULL);
      INSERT INTO payload_locked_documents_rels VALUES
        (1, 1, 0, 'document', 1, NULL),
        (2, 2, 0, 'document', NULL, 1),
        (3, 3, 0, 'document', 1, 1);
      CREATE TABLE payload_preferences (id integer PRIMARY KEY, key varchar);
      INSERT INTO payload_preferences VALUES
        (1, 'collection-search'), (2, 'collection-search-1'),
        (3, 'collection-posts'), (4, 'collection-search-history');
    `)
  })

  afterEach(async () => {
    await client?.query('ROLLBACK')
    await client?.end()
  })

  it.each([
    ['search', 'SELECT id FROM search'],
    ['search_categories', 'SELECT id FROM search_categories'],
    ['search_rels', 'SELECT id FROM search_rels'],
    ['lock relation column', 'SELECT search_id FROM payload_locked_documents_rels'],
  ])('refuses to remove %s when an unexpected dependency exists', async (_name, query) => {
    await client.query(`CREATE VIEW sentinel AS ${query}; SAVEPOINT before_contract;`)
    await expect(up({ db } as unknown as Parameters<typeof up>[0])).rejects.toThrow()
    await client.query('ROLLBACK TO SAVEPOINT before_contract')
    expect((await client.query('SELECT * FROM sentinel')).rowCount).toBeGreaterThan(0)
    expect((await client.query('SELECT count(*)::int AS count FROM payload_preferences')).rows).toEqual([{ count: 4 }])
  })

  it('removes derived storage and owned metadata while preserving source data and shared locks', async () => {
    await up({ db } as unknown as Parameters<typeof up>[0])
    const result = await client.query(`SELECT to_regclass('search') AS search,
      to_regclass('search_categories') AS categories, to_regclass('search_rels') AS relations,
      to_regclass('search_id_seq') AS sequence`)
    expect(result.rows).toEqual([{ search: null, categories: null, relations: null, sequence: null }])
    expect((await client.query('SELECT * FROM posts')).rows).toEqual([{ id: 1, title: 'Keep the original post' }])
    expect((await client.query('SELECT * FROM categories')).rows).toEqual([{ id: 1, title: 'Keep the category' }])
    expect((await client.query('SELECT * FROM platform_content_media')).rows).toEqual([{ id: 1, filename: 'keep.png' }])
    expect((await client.query('SELECT id FROM payload_locked_documents ORDER BY id')).rows).toEqual([
      { id: 2 },
      { id: 3 },
    ])
    expect((await client.query('SELECT id, posts_id FROM payload_locked_documents_rels ORDER BY id')).rows).toEqual([
      { id: 2, posts_id: 1 },
      { id: 3, posts_id: 1 },
    ])
    expect((await client.query('SELECT id FROM payload_preferences ORDER BY id')).rows).toEqual([{ id: 3 }, { id: 4 }])
    await client.query('SAVEPOINT before_rollback')
    await expect(down({ db } as unknown as Parameters<typeof down>[0])).rejects.toThrow()
    await client.query('ROLLBACK TO SAVEPOINT before_rollback')
    expect((await client.query("SELECT to_regclass('search') AS relation")).rows).toEqual([{ relation: null }])
  })
})
