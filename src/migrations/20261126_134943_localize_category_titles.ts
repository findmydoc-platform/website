import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE "categories_locales" (
    "title" varchar NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" integer NOT NULL
  );

  ALTER TABLE "categories_locales" ADD CONSTRAINT "categories_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "categories_locales_locale_parent_id_unique" ON "categories_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "categories_locales_parent_id_idx" ON "categories_locales" USING btree ("_parent_id");
  -- Preserve the legacy column for the pre-localization app.
  INSERT INTO "categories_locales" ("title", "_locale", "_parent_id")
  SELECT "title", 'en', "id" FROM "categories" WHERE "title" IS NOT NULL
  ON CONFLICT ("_locale", "_parent_id") DO NOTHING;
  ALTER TABLE "categories" ALTER COLUMN "title" DROP NOT NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM "categories_locales" WHERE "_locale" <> 'en') THEN
      RAISE EXCEPTION 'Cannot revert category titles after a non-English title has been saved';
    END IF;
  END $$;

  UPDATE "categories" AS category
  SET "title" = localized."title"
  FROM "categories_locales" AS localized
  WHERE localized."_parent_id" = category."id" AND localized."_locale" = 'en';
  ALTER TABLE "categories" ALTER COLUMN "title" SET NOT NULL;
  DROP TABLE "categories_locales";`)
}
