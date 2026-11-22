import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { drizzle, type NodePgClient } from '@payloadcms/db-postgres/drizzle/node-postgres'
import { describe, expect, it } from 'vitest'

import { up } from '@/migrations/20261122_215857_localize_page_publication'
import { deriveDatabaseConfig } from '../../../scripts/test-database-harness.mjs'

const legacyPageFixture = `
  CREATE TYPE _locales AS ENUM ('en', 'de');
  CREATE TYPE enum_pages_status AS ENUM ('draft', 'published');
  CREATE TYPE enum__pages_v_version_status AS ENUM ('draft', 'published');
  CREATE TABLE pages (
    id integer PRIMARY KEY, slug varchar, generate_slug boolean, _status enum_pages_status
  );
  CREATE TABLE pages_locales (
    _locale _locales NOT NULL, _parent_id integer NOT NULL REFERENCES pages,
    title varchar, meta_title varchar, meta_description varchar, UNIQUE (_locale, _parent_id)
  );
  CREATE TABLE _pages_v (
    id integer PRIMARY KEY, parent_id integer REFERENCES pages, published_locale _locales,
    version_slug varchar, version_generate_slug boolean, version__status enum__pages_v_version_status
  );
  CREATE TABLE _pages_v_locales (
    _locale _locales NOT NULL, _parent_id integer NOT NULL REFERENCES _pages_v,
    version_title varchar, UNIQUE (_locale, _parent_id)
  );
  CREATE UNIQUE INDEX pages_slug_idx ON pages (slug);
  CREATE INDEX pages__status_idx ON pages (_status);
  CREATE INDEX _pages_v_version_version_slug_idx ON _pages_v (version_slug);
  CREATE INDEX _pages_v_version_version__status_idx ON _pages_v (version__status);

  INSERT INTO pages VALUES (41, 'legacy-public', false, 'published'), (42, 'legacy-draft', true, 'draft');
  INSERT INTO pages_locales VALUES
    ('en', 41, 'Existing English title', 'Existing SEO title', 'Existing SEO description'),
    ('de', 41, 'Unreleased German translation', NULL, NULL),
    ('en', 42, 'Unpublished English work', NULL, NULL);
  INSERT INTO _pages_v VALUES
    (101, 41, 'en', 'legacy-public', false, 'published'),
    (102, 42, NULL, 'legacy-draft', true, 'draft');
  INSERT INTO _pages_v_locales VALUES
    ('en', 101, 'English publication snapshot'),
    ('de', 101, 'Unreleased German snapshot'),
    ('en', 102, 'English draft snapshot');
`

describe('Page locale publication migration', () => {
  it('preserves published and draft English Pages and retains untranslated publication separately', async () => {
    const { connectionString } = deriveDatabaseConfig(process.env.DATABASE_URI)
    const client = new Client({ connectionString })
    await client.connect()
    const db = drizzle(client as unknown as NodePgClient)
    const schema = `page_locales_${randomUUID().replaceAll('-', '')}`

    try {
      await client.query(`BEGIN; CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}";`)
      await client.query(legacyPageFixture)
      await up({ db } as unknown as Parameters<typeof up>[0])

      const localized = await client.query(`
        SELECT p.id, p.legacy_english_slug, l._locale, l._status, l.slug, l.generate_slug,
               l.title, l.meta_title, l.meta_description
        FROM pages AS p JOIN pages_locales AS l ON l._parent_id = p.id
        ORDER BY p.id, l._locale
      `)
      expect(localized.rows).toEqual([
        {
          id: 41,
          legacy_english_slug: 'legacy-public',
          _locale: 'en',
          _status: 'published',
          slug: 'legacy-public',
          generate_slug: false,
          title: 'Existing English title',
          meta_title: 'Existing SEO title',
          meta_description: 'Existing SEO description',
        },
        {
          id: 41,
          legacy_english_slug: 'legacy-public',
          _locale: 'de',
          _status: 'draft',
          slug: 'legacy-public',
          generate_slug: false,
          title: 'Unreleased German translation',
          meta_title: null,
          meta_description: null,
        },
        {
          id: 42,
          legacy_english_slug: null,
          _locale: 'en',
          _status: 'draft',
          slug: 'legacy-draft',
          generate_slug: true,
          title: 'Unpublished English work',
          meta_title: null,
          meta_description: null,
        },
      ])

      const versions = await client.query(`
        SELECT v.parent_id, l._locale, l.version__status, l.version_slug, l.version_title
        FROM _pages_v AS v JOIN _pages_v_locales AS l ON l._parent_id = v.id
        ORDER BY v.id, l._locale
      `)
      expect(versions.rows).toEqual([
        {
          parent_id: 41,
          _locale: 'en',
          version__status: 'published',
          version_slug: 'legacy-public',
          version_title: 'English publication snapshot',
        },
        {
          parent_id: 41,
          _locale: 'de',
          version__status: 'draft',
          version_slug: 'legacy-public',
          version_title: 'Unreleased German snapshot',
        },
        {
          parent_id: 42,
          _locale: 'en',
          version__status: 'draft',
          version_slug: 'legacy-draft',
          version_title: 'English draft snapshot',
        },
      ])
    } finally {
      await client.query('ROLLBACK')
      await client.end()
    }
  })
})
