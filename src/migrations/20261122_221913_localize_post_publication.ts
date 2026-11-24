import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Retain the shared columns and indexes for the pre-rollout application during expansion.
  await db.execute(sql`
  DO $$ BEGIN
  -- The final index and backfill are committed together. A completed expansion must not
  -- read the shared columns again after the localized application starts writing.
  IF to_regclass(format('%I.%I', current_schema(), 'posts_legacy_english_slug_idx')) IS NOT NULL THEN
    RETURN;
  END IF;

  ALTER INDEX "posts_slug_idx" RENAME TO "posts_shared_slug_idx";
  ALTER INDEX "posts__status_idx" RENAME TO "posts_shared_status_idx";
  ALTER INDEX "_posts_v_version_version_slug_idx" RENAME TO "posts_versions_shared_slug_idx";
  ALTER INDEX "_posts_v_version_version__status_idx" RENAME TO "posts_versions_shared_status_idx";
  ALTER TABLE "posts" ADD COLUMN "legacy_english_slug" varchar;
  ALTER TABLE "posts_locales" ADD COLUMN "generate_slug" boolean DEFAULT true;
  ALTER TABLE "posts_locales" ADD COLUMN "slug" varchar;
  ALTER TABLE "posts_locales" ADD COLUMN "_status" "enum_posts_status";
  ALTER TABLE "_posts_v" ADD COLUMN "version_legacy_english_slug" varchar;
  ALTER TABLE "_posts_v_locales" ADD COLUMN "version_generate_slug" boolean DEFAULT true;
  ALTER TABLE "_posts_v_locales" ADD COLUMN "version_slug" varchar;
  ALTER TABLE "_posts_v_locales" ADD COLUMN "version__status" "enum__posts_v_version_status";
  UPDATE "posts"
  SET "legacy_english_slug" = "slug"
  WHERE "legacy_english_slug" IS NULL AND "_status" = 'published';

  UPDATE "_posts_v" AS version
  SET "version_legacy_english_slug" = document."legacy_english_slug"
  FROM "posts" AS document
  WHERE version."parent_id" = document."id" AND version."version_legacy_english_slug" IS NULL;

  -- Only existing locale rows from selected or all-locale publications are evidence.
  -- Companion snapshots can contain unpublished edits, so restoring them must keep draft status.
  WITH first_publication AS (
    SELECT DISTINCT ON (version."parent_id", localized."_locale")
      version."parent_id", localized."_locale", version."created_at", version."id"
    FROM "_posts_v" AS version
    JOIN "_posts_v_locales" AS localized ON localized."_parent_id" = version."id"
    WHERE version."version__status" = 'published' AND version."snapshot" IS NOT TRUE
      AND (version."published_locale"::text = localized."_locale"::text OR version."published_locale" IS NULL)
    ORDER BY version."parent_id", localized."_locale", version."created_at", version."id"
  ), locales ("code") AS (
    VALUES ('en'::"_locales"), ('de'::"_locales")
  ), live_backfill AS (
    INSERT INTO "posts_locales" ("_locale", "_parent_id", "generate_slug", "slug", "_status")
    SELECT locale."code", document."id",
      CASE WHEN locale."code" = 'de' AND document."legacy_english_slug" IS NOT NULL
        THEN false ELSE document."generate_slug" END,
      CASE WHEN locale."code" = 'de' THEN COALESCE(document."legacy_english_slug", document."slug")
        ELSE document."slug" END,
      CASE WHEN document."_status" = 'published' AND existing."_parent_id" IS NOT NULL AND (
        publication."id" IS NOT NULL OR (locale."code" = 'en' AND german_publication."id" IS NULL)
      ) THEN 'published'::"enum_posts_status" ELSE 'draft'::"enum_posts_status" END
    FROM "posts" AS document CROSS JOIN locales AS locale
    LEFT JOIN "posts_locales" AS existing ON existing."_parent_id" = document."id" AND existing."_locale" = locale."code"
    LEFT JOIN first_publication AS publication ON publication."parent_id" = document."id" AND publication."_locale" = locale."code"
    LEFT JOIN first_publication AS german_publication ON german_publication."parent_id" = document."id" AND german_publication."_locale" = 'de'
    WHERE locale."code" = 'en' OR existing."_parent_id" IS NOT NULL OR document."legacy_english_slug" IS NOT NULL
    ON CONFLICT ("_locale", "_parent_id") DO UPDATE
      SET "generate_slug" = EXCLUDED."generate_slug", "slug" = EXCLUDED."slug", "_status" = EXCLUDED."_status"
      WHERE "posts_locales"."_status" IS NULL
  )
  INSERT INTO "_posts_v_locales" ("_locale", "_parent_id", "version_generate_slug", "version_slug", "version__status")
  SELECT locale."code", version."id",
    CASE WHEN locale."code" = 'de' AND version."version_legacy_english_slug" IS NOT NULL
      THEN false ELSE version."version_generate_slug" END,
    CASE WHEN locale."code" = 'de' THEN COALESCE(version."version_legacy_english_slug", version."version_slug")
      ELSE version."version_slug" END,
    CASE WHEN existing."_parent_id" IS NOT NULL
      AND version."version__status" = 'published' AND version."snapshot" IS NOT TRUE
      AND (version."created_at", version."id") >= (publication."created_at", publication."id")
    THEN 'published'::"enum__posts_v_version_status" ELSE 'draft'::"enum__posts_v_version_status" END
  FROM "_posts_v" AS version CROSS JOIN locales AS locale
  LEFT JOIN "_posts_v_locales" AS existing ON existing."_parent_id" = version."id" AND existing."_locale" = locale."code"
  LEFT JOIN first_publication AS publication ON publication."parent_id" = version."parent_id" AND publication."_locale" = locale."code"
  WHERE locale."code" = 'en' OR existing."_parent_id" IS NOT NULL OR version."version_legacy_english_slug" IS NOT NULL
  ON CONFLICT ("_locale", "_parent_id") DO UPDATE
    SET "version_generate_slug" = EXCLUDED."version_generate_slug",
        "version_slug" = EXCLUDED."version_slug", "version__status" = EXCLUDED."version__status"
    WHERE "_posts_v_locales"."version__status" IS NULL;

  ALTER TABLE "posts_locales" ALTER COLUMN "_status" SET DEFAULT 'draft';
  ALTER TABLE "_posts_v_locales" ALTER COLUMN "version__status" SET DEFAULT 'draft';
  CREATE UNIQUE INDEX "posts_slug_idx" ON "posts_locales" USING btree ("slug","_locale");
  CREATE INDEX "posts__status_idx" ON "posts_locales" USING btree ("_status","_locale");
  CREATE INDEX "_posts_v_version_version_legacy_english_slug_idx" ON "_posts_v" USING btree ("version_legacy_english_slug");
  CREATE INDEX "_posts_v_version_version_slug_idx" ON "_posts_v_locales" USING btree ("version_slug","_locale");
  CREATE INDEX "_posts_v_version_version__status_idx" ON "_posts_v_locales" USING btree ("version__status","_locale");
  CREATE INDEX "posts_legacy_english_slug_idx" ON "posts" USING btree ("legacy_english_slug");
  END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // The prior schema cannot represent independent publication or updated localized slugs.
  await db.execute(sql`
  DO $$ BEGIN
    IF EXISTS (
      SELECT 1
      FROM "posts_locales" AS localized
      JOIN "posts" AS post ON post."id" = localized."_parent_id"
      WHERE (localized."_locale" = 'de' AND localized."_status" = 'published')
         OR (localized."_locale" = 'en' AND (
           localized."slug" IS DISTINCT FROM post."slug"
           OR localized."_status" IS DISTINCT FROM post."_status"
         ))
    ) THEN
      RAISE EXCEPTION 'Cannot revert Post locale publication after localized publication or English slug changes';
    END IF;
  END $$;
  DROP INDEX "posts_legacy_english_slug_idx";
  DROP INDEX "posts_slug_idx";
  DROP INDEX "posts__status_idx";
  DROP INDEX "_posts_v_version_version_legacy_english_slug_idx";
  DROP INDEX "_posts_v_version_version_slug_idx";
  DROP INDEX "_posts_v_version_version__status_idx";
  ALTER INDEX "posts_shared_slug_idx" RENAME TO "posts_slug_idx";
  ALTER INDEX "posts_shared_status_idx" RENAME TO "posts__status_idx";
  ALTER INDEX "posts_versions_shared_slug_idx" RENAME TO "_posts_v_version_version_slug_idx";
  ALTER INDEX "posts_versions_shared_status_idx" RENAME TO "_posts_v_version_version__status_idx";
  ALTER TABLE "posts" DROP COLUMN "legacy_english_slug";
  ALTER TABLE "posts_locales" DROP COLUMN "generate_slug";
  ALTER TABLE "posts_locales" DROP COLUMN "slug";
  ALTER TABLE "posts_locales" DROP COLUMN "_status";
  ALTER TABLE "_posts_v" DROP COLUMN "version_legacy_english_slug";
  ALTER TABLE "_posts_v_locales" DROP COLUMN "version_generate_slug";
  ALTER TABLE "_posts_v_locales" DROP COLUMN "version_slug";
  ALTER TABLE "_posts_v_locales" DROP COLUMN "version__status";`)
}
