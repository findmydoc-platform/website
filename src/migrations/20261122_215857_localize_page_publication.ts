import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Retain the shared columns and indexes for the pre-rollout application during expansion.
  await db.execute(sql`
  ALTER INDEX "pages_slug_idx" RENAME TO "pages_shared_slug_idx";
  ALTER INDEX "pages__status_idx" RENAME TO "pages_shared_status_idx";
  ALTER INDEX "_pages_v_version_version_slug_idx" RENAME TO "pages_versions_shared_slug_idx";
  ALTER INDEX "_pages_v_version_version__status_idx" RENAME TO "pages_versions_shared_status_idx";
  ALTER TABLE "pages" ADD COLUMN "legacy_english_slug" varchar;
  ALTER TABLE "pages_locales" ADD COLUMN "generate_slug" boolean DEFAULT true;
  ALTER TABLE "pages_locales" ADD COLUMN "slug" varchar;
  ALTER TABLE "pages_locales" ADD COLUMN "_status" "enum_pages_status" DEFAULT 'draft';
  ALTER TABLE "_pages_v" ADD COLUMN "version_legacy_english_slug" varchar;
  ALTER TABLE "_pages_v_locales" ADD COLUMN "version_generate_slug" boolean DEFAULT true;
  ALTER TABLE "_pages_v_locales" ADD COLUMN "version_slug" varchar;
  ALTER TABLE "_pages_v_locales" ADD COLUMN "version__status" "enum__pages_v_version_status" DEFAULT 'draft';
  UPDATE "pages"
  SET "legacy_english_slug" = "slug"
  WHERE "legacy_english_slug" IS NULL AND "_status" = 'published';

  INSERT INTO "pages_locales" ("_locale", "_parent_id", "generate_slug", "slug", "_status")
  SELECT 'en', "id", "generate_slug", "slug", "_status" FROM "pages"
  ON CONFLICT ("_locale", "_parent_id") DO UPDATE
    SET "generate_slug" = EXCLUDED."generate_slug", "slug" = EXCLUDED."slug", "_status" = EXCLUDED."_status";

  UPDATE "pages_locales" AS localized
  SET "slug" = page."slug", "generate_slug" = page."generate_slug"
  FROM "pages" AS page
  WHERE localized."_locale" = 'de' AND localized."_parent_id" = page."id" AND localized."slug" IS NULL;

  UPDATE "_pages_v" AS version
  SET "version_legacy_english_slug" = page."legacy_english_slug"
  FROM "pages" AS page
  WHERE version."parent_id" = page."id" AND version."version_legacy_english_slug" IS NULL;

  INSERT INTO "_pages_v_locales" ("_locale", "_parent_id", "version_generate_slug", "version_slug", "version__status")
  SELECT 'en', "id", "version_generate_slug", "version_slug", "version__status" FROM "_pages_v"
  ON CONFLICT ("_locale", "_parent_id") DO UPDATE
    SET "version_generate_slug" = EXCLUDED."version_generate_slug",
        "version_slug" = EXCLUDED."version_slug", "version__status" = EXCLUDED."version__status";

  UPDATE "_pages_v_locales" AS localized
  SET "version_slug" = version."version_slug", "version_generate_slug" = version."version_generate_slug",
      "version__status" = CASE
        WHEN version."published_locale" = 'de' THEN version."version__status"
        ELSE 'draft'::"enum__pages_v_version_status"
      END
  FROM "_pages_v" AS version
  WHERE localized."_locale" = 'de' AND localized."_parent_id" = version."id" AND localized."version_slug" IS NULL;

  CREATE INDEX "pages_legacy_english_slug_idx" ON "pages" USING btree ("legacy_english_slug");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages_locales" USING btree ("slug","_locale");
  CREATE INDEX "pages__status_idx" ON "pages_locales" USING btree ("_status","_locale");
  CREATE INDEX "_pages_v_version_version_legacy_english_slug_idx" ON "_pages_v" USING btree ("version_legacy_english_slug");
  CREATE INDEX "_pages_v_version_version_slug_idx" ON "_pages_v_locales" USING btree ("version_slug","_locale");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "_pages_v_locales" USING btree ("version__status","_locale");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // The prior schema cannot represent independent publication or updated localized slugs.
  await db.execute(sql`
  DO $$ BEGIN
    IF EXISTS (
      SELECT 1
      FROM "pages_locales" AS localized
      JOIN "pages" AS page ON page."id" = localized."_parent_id"
      WHERE (localized."_locale" = 'de' AND localized."_status" = 'published')
         OR (localized."_locale" = 'en' AND (
           localized."slug" IS DISTINCT FROM page."slug"
           OR localized."_status" IS DISTINCT FROM page."_status"
         ))
    ) THEN
      RAISE EXCEPTION 'Cannot revert Page locale publication after localized publication or English slug changes';
    END IF;
  END $$;
  DROP INDEX "pages_legacy_english_slug_idx";
  DROP INDEX "pages_slug_idx";
  DROP INDEX "pages__status_idx";
  DROP INDEX "_pages_v_version_version_legacy_english_slug_idx";
  DROP INDEX "_pages_v_version_version_slug_idx";
  DROP INDEX "_pages_v_version_version__status_idx";
  ALTER INDEX "pages_shared_slug_idx" RENAME TO "pages_slug_idx";
  ALTER INDEX "pages_shared_status_idx" RENAME TO "pages__status_idx";
  ALTER INDEX "pages_versions_shared_slug_idx" RENAME TO "_pages_v_version_version_slug_idx";
  ALTER INDEX "pages_versions_shared_status_idx" RENAME TO "_pages_v_version_version__status_idx";
  ALTER TABLE "pages" DROP COLUMN "legacy_english_slug";
  ALTER TABLE "pages_locales" DROP COLUMN "generate_slug";
  ALTER TABLE "pages_locales" DROP COLUMN "slug";
  ALTER TABLE "pages_locales" DROP COLUMN "_status";
  ALTER TABLE "_pages_v" DROP COLUMN "version_legacy_english_slug";
  ALTER TABLE "_pages_v_locales" DROP COLUMN "version_generate_slug";
  ALTER TABLE "_pages_v_locales" DROP COLUMN "version_slug";
  ALTER TABLE "_pages_v_locales" DROP COLUMN "version__status";`)
}
