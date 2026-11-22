import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { drizzle, type NodePgClient } from '@payloadcms/db-postgres/drizzle/node-postgres'
import { describe, expect, it } from 'vitest'

import { up } from '@/migrations/20261122_221913_localize_post_publication'
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
    version_slug varchar, version_generate_slug boolean, version__status enum__posts_v_version_status
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
  INSERT INTO _posts_v VALUES
    (101, 41, 'en', 'legacy-public', false, 'published'),
    (102, 42, NULL, 'legacy-draft', true, 'draft');
  INSERT INTO _posts_v_locales VALUES
    ('en', 101, 'English publication snapshot'),
    ('de', 101, 'Unreleased German snapshot'),
    ('en', 102, 'English draft snapshot');
`

describe('Post locale publication migration', () => {
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
})
