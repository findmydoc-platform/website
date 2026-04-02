import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "cookie_consent_optional_categories" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"description" varchar NOT NULL
  );
  
  ALTER TABLE "cookie_consent" ALTER COLUMN "banner_description" SET DEFAULT 'We use essential cookies to keep the site working and optional cookies to understand usage and improve the experience.';
  UPDATE "cookie_consent"
  SET
    "consent_version" = 2,
    "banner_description" = 'We use essential cookies to keep the site working and optional cookies to understand usage and improve the experience.'
  ;

  INSERT INTO "cookie_consent_optional_categories" ("_order", "_parent_id", "id", "key", "label", "description")
  SELECT
    0,
    "id",
    concat("id", '_analytics'),
    'analytics',
    'Analytics cookies',
    'Help us understand how the site is used so we can improve it.'
  FROM "cookie_consent"
  ON CONFLICT DO NOTHING;

  INSERT INTO "cookie_consent_optional_categories" ("_order", "_parent_id", "id", "key", "label", "description")
  SELECT
    1,
    "id",
    concat("id", '_functional'),
    'functional',
    'Functional cookies',
    'Remember helpful preferences and support a smoother experience.'
  FROM "cookie_consent"
  ON CONFLICT DO NOTHING;

  ALTER TABLE "cookie_consent_optional_categories" ADD CONSTRAINT "cookie_consent_optional_categories_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cookie_consent"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cookie_consent_optional_categories_order_idx" ON "cookie_consent_optional_categories" USING btree ("_order");
  CREATE INDEX "cookie_consent_optional_categories_parent_id_idx" ON "cookie_consent_optional_categories" USING btree ("_parent_id");
  ALTER TABLE "cookie_consent" DROP COLUMN "analytics_label";
  ALTER TABLE "cookie_consent" DROP COLUMN "analytics_description";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "cookie_consent_optional_categories" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "cookie_consent_optional_categories" CASCADE;
  ALTER TABLE "cookie_consent" ALTER COLUMN "banner_description" SET DEFAULT 'We use essential cookies to keep the site working and optional analytics cookies to understand usage and improve the experience.';
  UPDATE "cookie_consent"
  SET
    "consent_version" = 1,
    "banner_description" = 'We use essential cookies to keep the site working and optional analytics cookies to understand usage and improve the experience.'
  ;

  ALTER TABLE "cookie_consent" ADD COLUMN "analytics_label" varchar DEFAULT 'Analytics cookies' NOT NULL;
  ALTER TABLE "cookie_consent" ADD COLUMN "analytics_description" varchar DEFAULT 'Help us understand how the site is used so we can improve it.' NOT NULL;`)
}
