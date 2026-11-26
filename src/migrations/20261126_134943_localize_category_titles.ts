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

  ALTER TABLE "categories" ADD COLUMN "title_search" varchar;
  ALTER TABLE "categories" ADD COLUMN "title_revision" numeric;
  ALTER TABLE "categories" ALTER COLUMN "title" DROP NOT NULL;

  -- The original title is retained for old readers and for legacy titles of unknown language.
  UPDATE "categories" SET "title_search" = "title" WHERE "title_search" IS NULL;

  -- These exact legacy values have verified English provenance in the baseline catalogue.
  INSERT INTO "categories_locales" ("title", "_locale", "_parent_id")
  SELECT category."title", 'en', category."id"
  FROM "categories" category
  JOIN (VALUES
    ('88888888-8888-8888-8888-888888888888', 'Clinic Insights'),
    ('99999999-9999-9999-9999-999999999999', 'Patient Guides'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Recovery'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Treatment Planning'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Travel & Logistics')
  ) AS baseline("stable_id", "title")
    ON baseline."stable_id" = category."stable_id" AND baseline."title" = category."title"
  ON CONFLICT ("_locale", "_parent_id") DO NOTHING;

  CREATE FUNCTION guard_category_title_revision() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    -- The locale projection updates the base row within the same transaction.
    IF pg_trigger_depth() > 1 THEN
      RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
      -- Drizzle runs INSERT triggers before resolving an upsert conflict.
      IF NEW."title_revision" IS NULL THEN
        RAISE EXCEPTION 'This app version cannot create categories after the title cutover';
      END IF;
    ELSIF NEW."title_revision" IS DISTINCT FROM COALESCE(OLD."title_revision", 0) + 1 THEN
      RAISE EXCEPTION 'Category changed while saving. Reload and retry.' USING ERRCODE = '40001';
    END IF;
    RETURN NEW;
  END;
  $$;

  CREATE TRIGGER category_title_revision_guard
    BEFORE INSERT OR UPDATE ON "categories"
    FOR EACH ROW EXECUTE FUNCTION guard_category_title_revision();

  CREATE FUNCTION project_category_titles() RETURNS trigger LANGUAGE plpgsql AS $$
  DECLARE
    english_title varchar;
    german_title varchar;
  BEGIN
    SELECT max("title") FILTER (WHERE "_locale" = 'en'), max("title") FILTER (WHERE "_locale" = 'de')
      INTO english_title, german_title
      FROM "categories_locales" WHERE "_parent_id" = NEW."_parent_id";

    UPDATE "categories"
      SET "title" = COALESCE(english_title, german_title, "title"),
          "title_search" = CASE
            WHEN german_title IS NOT NULL AND german_title IS DISTINCT FROM english_title
              THEN concat_ws(' / ', german_title, english_title)
            ELSE COALESCE(english_title, german_title, "title_search")
          END
      WHERE "id" = NEW."_parent_id";
    RETURN NEW;
  END;
  $$;

  -- Payload replaces all locale rows on update. Refresh the projection on reinsertion.
  CREATE TRIGGER category_title_projection
    AFTER INSERT OR UPDATE ON "categories_locales"
    FOR EACH ROW EXECUTE FUNCTION project_category_titles();`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  LOCK TABLE "categories", "categories_locales" IN ACCESS EXCLUSIVE MODE;

  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM "categories_locales" WHERE "_locale" <> 'en') THEN
      RAISE EXCEPTION 'Cannot revert category titles after a non-English title has been saved';
    END IF;
  END $$;

  DROP TRIGGER category_title_projection ON "categories_locales";
  DROP FUNCTION project_category_titles();
  DROP TRIGGER category_title_revision_guard ON "categories";
  DROP FUNCTION guard_category_title_revision();

  UPDATE "categories" AS category
  SET "title" = localized."title"
  FROM "categories_locales" AS localized
  WHERE localized."_parent_id" = category."id" AND localized."_locale" = 'en';
  ALTER TABLE "categories" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "categories" DROP COLUMN "title_search", DROP COLUMN "title_revision";
  DROP TABLE "categories_locales";`)
}
