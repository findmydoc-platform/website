import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Retain the shared columns and indexes for the pre-rollout application during expansion.
  await db.execute(sql`
  ALTER INDEX "posts_slug_idx" RENAME TO "posts_shared_slug_idx";
  ALTER INDEX "posts__status_idx" RENAME TO "posts_shared_status_idx";
  ALTER INDEX "_posts_v_version_version_slug_idx" RENAME TO "posts_versions_shared_slug_idx";
  ALTER INDEX "_posts_v_version_version__status_idx" RENAME TO "posts_versions_shared_status_idx";
  ALTER TABLE "posts" ADD COLUMN "legacy_english_slug" varchar;
  ALTER TABLE "posts_locales" ADD COLUMN "generate_slug" boolean DEFAULT true;
  ALTER TABLE "posts_locales" ADD COLUMN "slug" varchar;
  ALTER TABLE "posts_locales" ADD COLUMN "_status" "enum_posts_status" DEFAULT 'draft';
  ALTER TABLE "_posts_v" ADD COLUMN "version_legacy_english_slug" varchar;
  ALTER TABLE "_posts_v_locales" ADD COLUMN "version_generate_slug" boolean DEFAULT true;
  ALTER TABLE "_posts_v_locales" ADD COLUMN "version_slug" varchar;
  ALTER TABLE "_posts_v_locales" ADD COLUMN "version__status" "enum__posts_v_version_status" DEFAULT 'draft';
  UPDATE "posts"
  SET "legacy_english_slug" = "slug"
  WHERE "legacy_english_slug" IS NULL AND "_status" = 'published';

  INSERT INTO "posts_locales" ("_locale", "_parent_id", "generate_slug", "slug", "_status")
  SELECT 'en', "id", "generate_slug", "slug", "_status" FROM "posts"
  ON CONFLICT ("_locale", "_parent_id") DO UPDATE
    SET "generate_slug" = EXCLUDED."generate_slug", "slug" = EXCLUDED."slug", "_status" = EXCLUDED."_status";

  -- Keep the existing public link when the German title is first edited and published.
  INSERT INTO "posts_locales" ("_locale", "_parent_id", "generate_slug", "slug")
  SELECT 'de', "id", false, "legacy_english_slug" FROM "posts" WHERE "legacy_english_slug" IS NOT NULL
  ON CONFLICT ("_locale", "_parent_id") DO UPDATE
    SET "generate_slug" = EXCLUDED."generate_slug", "slug" = EXCLUDED."slug";

  UPDATE "posts_locales" AS localized
  SET "slug" = post."slug", "generate_slug" = post."generate_slug"
  FROM "posts" AS post
  WHERE localized."_locale" = 'de' AND localized."_parent_id" = post."id" AND localized."slug" IS NULL;

  UPDATE "_posts_v" AS version
  SET "version_legacy_english_slug" = post."legacy_english_slug"
  FROM "posts" AS post
  WHERE version."parent_id" = post."id" AND version."version_legacy_english_slug" IS NULL;

  INSERT INTO "_posts_v_locales" ("_locale", "_parent_id", "version_generate_slug", "version_slug", "version__status")
  SELECT 'en', "id", "version_generate_slug", "version_slug", "version__status" FROM "_posts_v"
  ON CONFLICT ("_locale", "_parent_id") DO UPDATE
    SET "version_generate_slug" = EXCLUDED."version_generate_slug",
        "version_slug" = EXCLUDED."version_slug", "version__status" = EXCLUDED."version__status";

  INSERT INTO "_posts_v_locales" ("_locale", "_parent_id", "version_generate_slug", "version_slug")
  SELECT 'de', "id", false, "version_legacy_english_slug"
  FROM "_posts_v" WHERE "version_legacy_english_slug" IS NOT NULL
  ON CONFLICT ("_locale", "_parent_id") DO NOTHING;

  UPDATE "_posts_v_locales" AS localized
  SET "version_slug" = COALESCE(version."version_legacy_english_slug", version."version_slug"),
      "version_generate_slug" = CASE WHEN version."version_legacy_english_slug" IS NOT NULL
        THEN false ELSE version."version_generate_slug" END,
      "version__status" = CASE
        WHEN version."published_locale" = 'de' THEN version."version__status"
        ELSE 'draft'::"enum__posts_v_version_status"
      END
  FROM "_posts_v" AS version
  WHERE localized."_locale" = 'de' AND localized."_parent_id" = version."id";

  CREATE INDEX "posts_legacy_english_slug_idx" ON "posts" USING btree ("legacy_english_slug");
  CREATE UNIQUE INDEX "posts_slug_idx" ON "posts_locales" USING btree ("slug","_locale");
  CREATE INDEX "posts__status_idx" ON "posts_locales" USING btree ("_status","_locale");
  CREATE INDEX "_posts_v_version_version_legacy_english_slug_idx" ON "_posts_v" USING btree ("version_legacy_english_slug");
  CREATE INDEX "_posts_v_version_version_slug_idx" ON "_posts_v_locales" USING btree ("version_slug","_locale");
  CREATE INDEX "_posts_v_version_version__status_idx" ON "_posts_v_locales" USING btree ("version__status","_locale");
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
