import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { drizzle, type NodePgClient } from '@payloadcms/db-postgres/drizzle/node-postgres'
import { describe, expect, it } from 'vitest'

import { up } from '@/migrations/20261122_221913_localize_post_publication'
import { up as repairEmptyGermanPublication } from '@/migrations/20261125_151218_repair_empty_german_post_publication'
import { deriveDatabaseConfig } from '../../../scripts/test-database-harness.mjs'

const legacyPostFixture = `
  CREATE TYPE _locales AS ENUM ('en', 'de');
  CREATE TYPE enum_posts_status AS ENUM ('draft', 'published');
  CREATE TYPE enum__posts_v_version_status AS ENUM ('draft', 'published');
  CREATE TABLE posts (
    id integer PRIMARY KEY, slug varchar, generate_slug boolean, _status enum_posts_status
  );
  CREATE TABLE posts_locales (
    _locale _locales NOT NULL, _parent_id integer NOT NULL REFERENCES posts,
    title varchar, meta_title varchar, meta_description varchar, content jsonb, excerpt varchar, UNIQUE (_locale, _parent_id)
  );
  CREATE TABLE _posts_v (
    id integer PRIMARY KEY, parent_id integer REFERENCES posts, published_locale _locales,
    version_slug varchar, version_generate_slug boolean, version__status enum__posts_v_version_status,
    snapshot boolean DEFAULT false, created_at timestamptz DEFAULT now()
  );
  CREATE TABLE _posts_v_locales (
    _locale _locales NOT NULL, _parent_id integer NOT NULL REFERENCES _posts_v,
    version_title varchar, UNIQUE (_locale, _parent_id)
  );
  CREATE UNIQUE INDEX posts_slug_idx ON posts (slug);
  CREATE INDEX posts__status_idx ON posts (_status);
  CREATE INDEX _posts_v_version_version_slug_idx ON _posts_v (version_slug);
  CREATE INDEX _posts_v_version_version__status_idx ON _posts_v (version__status);

  INSERT INTO posts VALUES (41, 'legacy-public', true, 'published'), (42, 'legacy-draft', true, 'draft');
  INSERT INTO posts_locales VALUES
    ('en', 41, 'Existing English title', 'Existing SEO title', 'Existing SEO description', '{"article": "Existing English body"}', 'Existing English excerpt'),
    ('de', 41, 'Unreleased German translation', NULL, NULL, NULL, NULL),
    ('en', 42, 'Unpublished English work', NULL, NULL, NULL, NULL);
  INSERT INTO _posts_v (id, parent_id, published_locale, version_slug, version_generate_slug, version__status) VALUES
    (101, 41, 'en', 'legacy-public', false, 'published'),
    (102, 42, NULL, 'legacy-draft', true, 'draft');
  INSERT INTO _posts_v_locales VALUES
    ('en', 101, 'English publication snapshot'),
    ('de', 101, 'Unreleased German snapshot'),
    ('en', 102, 'English draft snapshot');
`

describe('Post locale publication migration', () => {
  it('repairs empty German publications from legacy all-locale history without changing real publications', async () => {
    const { connectionString } = deriveDatabaseConfig(process.env.DATABASE_URI)
    const client = new Client({ connectionString })
    await client.connect()
    const db = drizzle(client as unknown as NodePgClient)
    const schema = `post_locales_${randomUUID().replaceAll('-', '')}`

    try {
      await client.query(`BEGIN; CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}";`)
      await client.query(legacyPostFixture)
      await client.query(`
        ALTER TABLE _posts_v_locales ADD COLUMN version_content jsonb;
        INSERT INTO posts VALUES (43, 'empty-german', true, 'published'), (44, 'public-german', true, 'published');
        INSERT INTO posts_locales (_locale, _parent_id, title, content) VALUES
          ('en', 43, 'Existing English article', '{"article": "English article body"}'),
          ('de', 43, NULL, NULL),
          ('en', 44, 'Bilingual article', '{"article": "English article body"}'),
          ('de', 44, 'Deutscher Artikel', '{"article": "Deutscher Artikeltext"}');
        INSERT INTO _posts_v (id, parent_id, published_locale, version_slug, version_generate_slug, version__status) VALUES
          (103, 43, NULL, 'empty-german', true, 'published'),
          (104, 44, NULL, 'public-german', true, 'published');
        INSERT INTO _posts_v_locales (_locale, _parent_id, version_title, version_content) VALUES
          ('en', 103, 'Existing English article', '{"article": "English article body"}'),
          ('de', 103, NULL, NULL),
          ('en', 104, 'Bilingual article', '{"article": "English article body"}'),
          ('de', 104, 'Deutscher Artikel', '{"article": "Deutscher Artikeltext"}');
      `)
      await up({ db } as unknown as Parameters<typeof up>[0])

      const readPublications = async () =>
        (
          await client.query(`
        SELECT live._parent_id AS id, live._locale, live._status, live.slug, live.title, live.content,
               historical.version__status, historical.version_title, historical.version_content
        FROM posts_locales live
        JOIN _posts_v version ON version.parent_id = live._parent_id
        JOIN _posts_v_locales historical ON historical._parent_id = version.id AND historical._locale = live._locale
        WHERE live._parent_id IN (43, 44)
        ORDER BY live._parent_id, live._locale
      `)
        ).rows
      const before = await readPublications()
      const emptyGerman = before.find((row) => row.id === 43 && row._locale === 'de')
      expect(emptyGerman).toMatchObject({
        title: null,
        content: null,
        _status: 'published',
        version__status: 'published',
      })

      await repairEmptyGermanPublication({ db } as unknown as Parameters<typeof repairEmptyGermanPublication>[0])
      const after = await readPublications()
      expect(after).toEqual(
        before.map((row) => (row === emptyGerman ? { ...row, _status: 'draft', version__status: 'draft' } : row)),
      )
      await repairEmptyGermanPublication({ db } as unknown as Parameters<typeof repairEmptyGermanPublication>[0])
      expect(await readPublications()).toEqual(after)
    } finally {
      await client.query('ROLLBACK')
      await client.end()
    }
  })

  it('preserves published and draft English Posts and retains untranslated publication separately', async () => {
    const { connectionString } = deriveDatabaseConfig(process.env.DATABASE_URI)
    const client = new Client({ connectionString })
    await client.connect()
    const db = drizzle(client as unknown as NodePgClient)
    const schema = `post_locales_${randomUUID().replaceAll('-', '')}`

    try {
      await client.query(`BEGIN; CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}";`)
      await client.query(legacyPostFixture)
      await up({ db } as unknown as Parameters<typeof up>[0])

      const localized = await client.query(`
        SELECT p.id, p.legacy_english_slug, l._locale, l._status, l.slug, l.generate_slug,
               l.title, l.meta_title, l.meta_description, l.content, l.excerpt
        FROM posts AS p JOIN posts_locales AS l ON l._parent_id = p.id
        ORDER BY p.id, l._locale
      `)
      expect(localized.rows).toEqual([
        {
          id: 41,
          legacy_english_slug: 'legacy-public',
          _locale: 'en',
          _status: 'published',
          slug: 'legacy-public',
          generate_slug: true,
          title: 'Existing English title',
          content: { article: 'Existing English body' },
          excerpt: 'Existing English excerpt',
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
          content: null,
          excerpt: null,
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
          content: null,
          excerpt: null,
          meta_title: null,
          meta_description: null,
        },
      ])

      const versions = await client.query(`
        SELECT v.parent_id, l._locale, l.version__status, l.version_slug, l.version_title
        FROM _posts_v AS v JOIN _posts_v_locales AS l ON l._parent_id = v.id
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

  it('preserves previously published German Posts and retains their existing public links', async () => {
    const { connectionString } = deriveDatabaseConfig(process.env.DATABASE_URI)
    const client = new Client({ connectionString })
    await client.connect()
    const db = drizzle(client as unknown as NodePgClient)
    const schema = `post_locale_history_${randomUUID().replaceAll('-', '')}`

    try {
      await client.query(`BEGIN; CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}";`)
      await client.query(legacyPostFixture)
      await client.query(`
        INSERT INTO posts VALUES (51, 'legacy-selected', true, 'published'),
          (52, 'legacy-all', true, 'published'), (53, 'legacy-withdrawn', true, 'draft'),
          (54, 'legacy-only-english', true, 'published');
        INSERT INTO posts_locales VALUES
          ('de', 51, 'Published German Article', NULL, NULL, '{"article": "Published German body"}', 'German excerpt'),
          ('de', 52, 'German in publish all', NULL, NULL, NULL, NULL),
          ('de', 53, 'Withdrawn German Article', NULL, NULL, NULL, NULL);
        INSERT INTO _posts_v VALUES
          (200, 51, 'de', 'older-slug', true, 'published', false, '2026-06-01'),
          (201, 51, 'en', 'older-slug', true, 'published', false, '2026-06-02'),
          (202, 51, 'en', 'legacy-selected', true, 'draft', true, '2026-06-02'),
          (203, 51, NULL, 'another-slug', true, 'draft', false, '2026-06-03'),
          (204, 52, NULL, 'legacy-all', true, 'published', false, '2026-06-01'),
          (205, 53, 'de', 'legacy-withdrawn', true, 'published', false, '2026-06-01'),
          (206, 54, NULL, 'legacy-only-english', true, 'published', false, '2026-06-01');
        INSERT INTO _posts_v_locales VALUES
          ('de', 200, 'Published German Article'), ('de', 201, 'Published German Article'),
          ('en', 201, 'Published English Article'), ('en', 202, 'English companion snapshot'),
          ('de', 202, 'Private German snapshot'),
          ('de', 203, 'Private German draft'), ('de', 204, 'German in publish all'),
          ('de', 205, 'Previously published German Article'), ('en', 206, 'Only English existed when published');
      `)
      await up({ db } as unknown as Parameters<typeof up>[0])

      expect(
        (
          await client.query(`SELECT _parent_id, slug, _status, generate_slug, title, content, excerpt FROM posts_locales
                              WHERE _locale = 'de' AND _parent_id >= 51 ORDER BY _parent_id`)
        ).rows,
      ).toEqual([
        {
          _parent_id: 51,
          slug: 'legacy-selected',
          _status: 'published',
          generate_slug: false,
          title: 'Published German Article',
          content: { article: 'Published German body' },
          excerpt: 'German excerpt',
        },
        {
          _parent_id: 52,
          slug: 'legacy-all',
          _status: 'published',
          generate_slug: false,
          title: 'German in publish all',
          content: null,
          excerpt: null,
        },
        {
          _parent_id: 53,
          slug: 'legacy-withdrawn',
          _status: 'draft',
          generate_slug: true,
          title: 'Withdrawn German Article',
          content: null,
          excerpt: null,
        },
        {
          _parent_id: 54,
          slug: 'legacy-only-english',
          _status: 'draft',
          generate_slug: false,
          title: null,
          content: null,
          excerpt: null,
        },
      ])
      expect(
        (
          await client.query(`SELECT _parent_id, version_slug, version__status, version_title FROM _posts_v_locales
                              WHERE (_locale = 'de' AND _parent_id >= 201) OR _parent_id = 202
                              ORDER BY _parent_id, _locale`)
        ).rows,
      ).toEqual([
        {
          _parent_id: 201,
          version_slug: 'legacy-selected',
          version__status: 'published',
          version_title: 'Published German Article',
        },
        {
          _parent_id: 202,
          version_slug: 'legacy-selected',
          version__status: 'draft',
          version_title: 'English companion snapshot',
        },
        {
          _parent_id: 202,
          version_slug: 'legacy-selected',
          version__status: 'draft',
          version_title: 'Private German snapshot',
        },
        {
          _parent_id: 203,
          version_slug: 'legacy-selected',
          version__status: 'draft',
          version_title: 'Private German draft',
        },
        {
          _parent_id: 204,
          version_slug: 'legacy-all',
          version__status: 'published',
          version_title: 'German in publish all',
        },
        {
          _parent_id: 205,
          version_slug: 'legacy-withdrawn',
          version__status: 'published',
          version_title: 'Previously published German Article',
        },
        { _parent_id: 206, version_slug: 'legacy-only-english', version__status: 'draft', version_title: null },
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
    const schema = `post_locale_draft_${randomUUID().replaceAll('-', '')}`

    try {
      await client.query(`BEGIN; CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}";`)
      await client.query(legacyPostFixture)
      await client.query(`
        INSERT INTO posts VALUES (51, 'german-first', false, 'published');
        INSERT INTO posts_locales VALUES
          ('en', 51, 'Private initial English draft', NULL, NULL, NULL, NULL), ('de', 51, 'Published German Post', NULL, NULL, NULL, NULL);
        INSERT INTO _posts_v VALUES
          (201, 51, NULL, 'german-first', false, 'draft', false, '2026-06-01'),
          (202, 51, 'de', 'german-first', false, 'published', false, '2026-06-02'),
          (203, 51, 'de', 'german-first', false, 'draft', true, '2026-06-02');
        INSERT INTO _posts_v_locales VALUES
          ('en', 201, 'Private initial English draft'), ('de', 202, 'Published German Post'),
          ('en', 203, 'Private initial English draft'), ('de', 203, 'Published German Post');
      `)
      await up({ db } as unknown as Parameters<typeof up>[0])

      expect(
        (await client.query("SELECT _status, title FROM posts_locales WHERE _locale = 'en' AND _parent_id = 51")).rows,
      ).toEqual([{ _status: 'draft', title: 'Private initial English draft' }])
      expect(
        (await client.query("SELECT version__status FROM _posts_v_locales WHERE _locale = 'en' AND _parent_id = 202"))
          .rows,
      ).toEqual([{ version__status: 'draft' }])
    } finally {
      await client.query('ROLLBACK')
      await client.end()
    }
  })

  it('keeps current Post locale slugs and publication when the expansion is replayed', async () => {
    const { connectionString } = deriveDatabaseConfig(process.env.DATABASE_URI)
    const client = new Client({ connectionString })
    await client.connect()
    const db = drizzle(client as unknown as NodePgClient)
    const schema = `post_locale_replay_${randomUUID().replaceAll('-', '')}`
    const migrate = () => up({ db } as unknown as Parameters<typeof up>[0])

    try {
      await client.query(`BEGIN; CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}";`)
      await client.query(legacyPostFixture)
      await migrate()
      await client.query(`
        UPDATE posts_locales SET slug = 'new-english-slug', _status = 'draft', generate_slug = false
          WHERE _parent_id = 41 AND _locale = 'en';
        UPDATE posts_locales SET slug = 'new-german-slug', _status = 'published', generate_slug = true
          WHERE _parent_id = 41 AND _locale = 'de';
        UPDATE _posts_v_locales SET version_slug = 'new-english-slug', version__status = 'draft', version_generate_slug = true
          WHERE _parent_id = 101 AND _locale = 'en';
        UPDATE _posts_v_locales SET version_slug = 'new-german-slug', version__status = 'published', version_generate_slug = true
          WHERE _parent_id = 101 AND _locale = 'de';
      `)
      await migrate()

      expect(
        (
          await client.query(
            'SELECT _locale, slug, _status, generate_slug FROM posts_locales WHERE _parent_id = 41 ORDER BY _locale',
          )
        ).rows,
      ).toEqual([
        { _locale: 'en', slug: 'new-english-slug', _status: 'draft', generate_slug: false },
        { _locale: 'de', slug: 'new-german-slug', _status: 'published', generate_slug: true },
      ])
      expect(
        (
          await client.query(
            'SELECT _locale, version_slug, version__status, version_generate_slug FROM _posts_v_locales WHERE _parent_id = 101 ORDER BY _locale',
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
