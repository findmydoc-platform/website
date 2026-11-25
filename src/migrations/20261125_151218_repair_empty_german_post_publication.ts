import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Legacy all-locale versions can contain an empty German row alongside published English content.
  await db.execute(sql`
    WITH repaired_posts AS (
      UPDATE "posts_locales" AS german
      SET "_status" = 'draft'
      FROM "posts" AS post
      WHERE post."id" = german."_parent_id"
        AND post."legacy_english_slug" IS NOT NULL
        AND german."_locale" = 'de'
        AND german."_status" = 'published'
        AND german."title" IS NULL
        AND german."content" IS NULL
        AND EXISTS (
          SELECT 1 FROM "posts_locales" AS english
          WHERE english."_parent_id" = post."id"
            AND english."_locale" = 'en'
            AND english."_status" = 'published'
            AND english."title" IS NOT NULL
            AND english."content" IS NOT NULL
        )
      RETURNING german."_parent_id"
    )
    UPDATE "_posts_v_locales" AS german
    SET "version__status" = 'draft'
    FROM "_posts_v" AS version
    JOIN repaired_posts ON repaired_posts."_parent_id" = version."parent_id"
    WHERE german."_parent_id" = version."id"
      AND german."_locale" = 'de'
      AND german."version__status" = 'published'
      AND german."version_title" IS NULL
      AND german."version_content" IS NULL;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error('This migration is forward-only because reverting it would republish empty German posts.')
}
