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
    version_slug varchar, version_generate_slug boolean, version__status enum__pages_v_version_status,
    snapshot boolean DEFAULT false, created_at timestamptz DEFAULT now()
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
  INSERT INTO _pages_v (id, parent_id, published_locale, version_slug, version_generate_slug, version__status) VALUES
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
  it('preserves German Page publication evidenced by selected and all-locale publication history', async () => {
    const { connectionString } = deriveDatabaseConfig(process.env.DATABASE_URI)
    const client = new Client({ connectionString })
    await client.connect()
    const db = drizzle(client as unknown as NodePgClient)
    const schema = `page_locale_history_${randomUUID().replaceAll('-', '')}`

    try {
      await client.query(`BEGIN; CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}";`)
      await client.query(legacyPageFixture)
      await client.query(`
        INSERT INTO pages VALUES
          (51, 'historically-selected', false, 'published'), (52, 'historically-all', false, 'published'),
          (53, 'historically-unpublished', false, 'draft'), (54, 'historically-draft-only', false, 'published');
        INSERT INTO pages_locales VALUES
          ('en', 51, 'Published English Page', NULL, NULL), ('de', 51, 'Published German Page', NULL, NULL),
          ('de', 52, 'German in publish all', NULL, NULL),
          ('de', 53, 'Withdrawn German Page', NULL, NULL), ('de', 54, 'German content without publication evidence', NULL, NULL);
        INSERT INTO _pages_v VALUES
          (201, 51, 'de', 'older-slug', false, 'published', false, '2026-06-01'),
          (202, 51, 'en', 'historically-selected', false, 'published', false, '2026-06-02'),
          (203, 51, 'en', 'historically-selected', false, 'draft', true, '2026-06-02'),
          (204, 51, NULL, 'new-draft-slug', false, 'draft', false, '2026-06-03'),
          (205, 52, NULL, 'historically-all', false, 'published', false, '2026-06-01'),
          (206, 53, 'de', 'historically-unpublished', false, 'published', false, '2026-06-01'),
          (207, 54, 'en', 'historically-draft-only', false, 'published', false, '2026-06-01'),
          (208, 54, 'de', 'historically-draft-only', false, 'draft', true, '2026-06-02');
        INSERT INTO _pages_v_locales VALUES
          ('de', 201, 'Published German Page'), ('de', 202, 'Published German Page'),
          ('en', 202, 'Published English Page'),
          ('en', 203, 'English companion snapshot'), ('de', 203, 'Private German snapshot'),
          ('de', 204, 'Private German draft'),
          ('de', 205, 'German in publish all'), ('de', 206, 'Previously published German Page'),
          ('en', 207, 'Published English Page'), ('de', 208, 'German content in an unmatched snapshot');
      `)
      await up({ db } as unknown as Parameters<typeof up>[0])

      expect(
        (
          await client.query(`SELECT _parent_id, slug, _status, title FROM pages_locales
                              WHERE _locale = 'de' AND _parent_id >= 51 ORDER BY _parent_id`)
        ).rows,
      ).toEqual([
        { _parent_id: 51, slug: 'historically-selected', _status: 'published', title: 'Published German Page' },
        { _parent_id: 52, slug: 'historically-all', _status: 'published', title: 'German in publish all' },
        { _parent_id: 53, slug: 'historically-unpublished', _status: 'draft', title: 'Withdrawn German Page' },
        {
          _parent_id: 54,
          slug: 'historically-draft-only',
          _status: 'draft',
          title: 'German content without publication evidence',
        },
      ])
      expect(
        (
          await client.query(`SELECT _parent_id, version__status, version_title FROM _pages_v_locales
                              WHERE (_locale = 'de' AND _parent_id >= 201) OR _parent_id = 203
                              ORDER BY _parent_id, _locale`)
        ).rows,
      ).toEqual([
        { _parent_id: 201, version__status: 'published', version_title: 'Published German Page' },
        { _parent_id: 202, version__status: 'published', version_title: 'Published German Page' },
        { _parent_id: 203, version__status: 'draft', version_title: 'English companion snapshot' },
        { _parent_id: 203, version__status: 'draft', version_title: 'Private German snapshot' },
        { _parent_id: 204, version__status: 'draft', version_title: 'Private German draft' },
        { _parent_id: 205, version__status: 'published', version_title: 'German in publish all' },
        { _parent_id: 206, version__status: 'published', version_title: 'Previously published German Page' },
        { _parent_id: 208, version__status: 'draft', version_title: 'German content in an unmatched snapshot' },
      ])
    } finally {
      await client.query('ROLLBACK')
      await client.end()
    }
  })

  it('keeps the English draft private when the historical publication selected German only', async () => {
    const { connectionString } = deriveDatabaseConfig(process.env.DATABASE_URI)
    const client = new Client({ connectionString })
    await client.connect()
    const db = drizzle(client as unknown as NodePgClient)
    const schema = `page_locale_draft_${randomUUID().replaceAll('-', '')}`

    try {
      await client.query(`BEGIN; CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}";`)
      await client.query(legacyPageFixture)
      await client.query(`
        INSERT INTO pages VALUES (51, 'german-first', false, 'published');
        INSERT INTO pages_locales VALUES
          ('en', 51, 'Private initial English draft', NULL, NULL), ('de', 51, 'Published German Page', NULL, NULL);
        INSERT INTO _pages_v VALUES
          (201, 51, NULL, 'german-first', false, 'draft', false, '2026-06-01'),
          (202, 51, 'de', 'german-first', false, 'published', false, '2026-06-02'),
          (203, 51, 'de', 'german-first', false, 'draft', true, '2026-06-02');
        INSERT INTO _pages_v_locales VALUES
          ('en', 201, 'Private initial English draft'), ('de', 202, 'Published German Page'),
          ('en', 203, 'Private initial English draft'), ('de', 203, 'Published German Page');
      `)
      await up({ db } as unknown as Parameters<typeof up>[0])

      expect(
        (await client.query("SELECT _status, title FROM pages_locales WHERE _locale = 'en' AND _parent_id = 51")).rows,
      ).toEqual([{ _status: 'draft', title: 'Private initial English draft' }])
      expect(
        (await client.query("SELECT version__status FROM _pages_v_locales WHERE _locale = 'en' AND _parent_id = 202"))
          .rows,
      ).toEqual([{ version__status: 'draft' }])
    } finally {
      await client.query('ROLLBACK')
      await client.end()
    }
  })

  it('keeps current Page locale slugs and publication when the expansion is replayed', async () => {
    const { connectionString } = deriveDatabaseConfig(process.env.DATABASE_URI)
    const client = new Client({ connectionString })
    await client.connect()
    const db = drizzle(client as unknown as NodePgClient)
    const schema = `page_locale_replay_${randomUUID().replaceAll('-', '')}`
    const migrate = () => up({ db } as unknown as Parameters<typeof up>[0])

    try {
      await client.query(`BEGIN; CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}";`)
      await client.query(legacyPageFixture)
      await migrate()
      await client.query(`
        UPDATE pages_locales SET slug = 'new-english-slug', _status = 'draft', generate_slug = true
          WHERE _parent_id = 41 AND _locale = 'en';
        UPDATE pages_locales SET slug = 'new-german-slug', _status = 'published', generate_slug = true
          WHERE _parent_id = 41 AND _locale = 'de';
        UPDATE _pages_v_locales SET version_slug = 'new-english-slug', version__status = 'draft', version_generate_slug = true
          WHERE _parent_id = 101 AND _locale = 'en';
        UPDATE _pages_v_locales SET version_slug = 'new-german-slug', version__status = 'published', version_generate_slug = true
          WHERE _parent_id = 101 AND _locale = 'de';
      `)
      await migrate()

      expect(
        (
          await client.query(
            'SELECT _locale, slug, _status, generate_slug FROM pages_locales WHERE _parent_id = 41 ORDER BY _locale',
          )
        ).rows,
      ).toEqual([
        { _locale: 'en', slug: 'new-english-slug', _status: 'draft', generate_slug: true },
        { _locale: 'de', slug: 'new-german-slug', _status: 'published', generate_slug: true },
      ])
      expect(
        (
          await client.query(
            'SELECT _locale, version_slug, version__status, version_generate_slug FROM _pages_v_locales WHERE _parent_id = 101 ORDER BY _locale',
          )
        ).rows,
      ).toEqual([
        { _locale: 'en', version_slug: 'new-english-slug', version__status: 'draft', version_generate_slug: true },
        { _locale: 'de', version_slug: 'new-german-slug', version__status: 'published', version_generate_slug: true },
      ])
    } finally {
      await client.query('ROLLBACK')
      await client.end()
    }
  })
})
