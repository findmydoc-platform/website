import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_cookie_consent_optional_category_settings_functional_tools" AS ENUM('posthog', 'openstreetmap');
  CREATE TYPE "public"."enum_cookie_consent_optional_category_settings_analytics_tools" AS ENUM('posthog', 'openstreetmap');
  CREATE TYPE "public"."enum_cookie_consent_optional_category_settings_marketing_tools" AS ENUM('posthog', 'openstreetmap');
  CREATE TABLE "cookie_consent_optional_category_settings_functional_tools" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_cookie_consent_optional_category_settings_functional_tools",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cookie_consent_optional_category_settings_analytics_tools" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_cookie_consent_optional_category_settings_analytics_tools",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cookie_consent_optional_category_settings_marketing_tools" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_cookie_consent_optional_category_settings_marketing_tools",
  	"id" serial PRIMARY KEY NOT NULL
  );
  ALTER TABLE "cookie_consent" ADD COLUMN "optional_category_settings_functional_enabled" boolean DEFAULT true;
  ALTER TABLE "cookie_consent" ADD COLUMN "optional_category_settings_functional_label" varchar DEFAULT 'Functional cookies' NOT NULL;
  ALTER TABLE "cookie_consent" ADD COLUMN "optional_category_settings_analytics_enabled" boolean DEFAULT true;
  ALTER TABLE "cookie_consent" ADD COLUMN "optional_category_settings_analytics_label" varchar DEFAULT 'Analytics cookies' NOT NULL;
  ALTER TABLE "cookie_consent" ADD COLUMN "optional_category_settings_marketing_enabled" boolean DEFAULT true;
  ALTER TABLE "cookie_consent" ADD COLUMN "optional_category_settings_marketing_label" varchar DEFAULT 'Marketing cookies' NOT NULL;

  UPDATE "cookie_consent"
  SET "consent_version" = 3;

  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'cookie_consent_optional_categories'
        AND column_name = 'enabled'
    ) THEN
      EXECUTE '
        UPDATE "cookie_consent" AS "cc"
        SET
          "optional_category_settings_functional_enabled" = COALESCE("src"."enabled", true),
          "optional_category_settings_functional_label" = COALESCE(NULLIF("src"."label", ''''''), ''Functional cookies'')
        FROM (
          SELECT "_parent_id" AS "parent_id", "enabled", "label"
          FROM "cookie_consent_optional_categories"
          WHERE "key" = ''functional''
        ) AS "src"
        WHERE "cc"."id" = "src"."parent_id"
      ';

      EXECUTE '
        UPDATE "cookie_consent" AS "cc"
        SET
          "optional_category_settings_analytics_enabled" = COALESCE("src"."enabled", true),
          "optional_category_settings_analytics_label" = COALESCE(NULLIF("src"."label", ''''''), ''Analytics cookies'')
        FROM (
          SELECT "_parent_id" AS "parent_id", "enabled", "label"
          FROM "cookie_consent_optional_categories"
          WHERE "key" = ''analytics''
        ) AS "src"
        WHERE "cc"."id" = "src"."parent_id"
      ';

      EXECUTE '
        UPDATE "cookie_consent" AS "cc"
        SET
          "optional_category_settings_marketing_enabled" = COALESCE("src"."enabled", true),
          "optional_category_settings_marketing_label" = COALESCE(NULLIF("src"."label", ''''''), ''Marketing cookies'')
        FROM (
          SELECT "_parent_id" AS "parent_id", "enabled", "label"
          FROM "cookie_consent_optional_categories"
          WHERE "key" = ''marketing''
        ) AS "src"
        WHERE "cc"."id" = "src"."parent_id"
      ';
    ELSE
      UPDATE "cookie_consent" AS "cc"
      SET
        "optional_category_settings_functional_enabled" = true,
        "optional_category_settings_functional_label" = COALESCE(NULLIF("src"."label", ''), 'Functional cookies')
      FROM (
        SELECT "_parent_id" AS "parent_id", "label"
        FROM "cookie_consent_optional_categories"
        WHERE "key" = 'functional'
      ) AS "src"
      WHERE "cc"."id" = "src"."parent_id";

      UPDATE "cookie_consent" AS "cc"
      SET
        "optional_category_settings_analytics_enabled" = true,
        "optional_category_settings_analytics_label" = COALESCE(NULLIF("src"."label", ''), 'Analytics cookies')
      FROM (
        SELECT "_parent_id" AS "parent_id", "label"
        FROM "cookie_consent_optional_categories"
        WHERE "key" = 'analytics'
      ) AS "src"
      WHERE "cc"."id" = "src"."parent_id";

      UPDATE "cookie_consent" AS "cc"
      SET
        "optional_category_settings_marketing_enabled" = true,
        "optional_category_settings_marketing_label" = COALESCE(NULLIF("src"."label", ''), 'Marketing cookies')
      FROM (
        SELECT "_parent_id" AS "parent_id", "label"
        FROM "cookie_consent_optional_categories"
        WHERE "key" = 'marketing'
      ) AS "src"
      WHERE "cc"."id" = "src"."parent_id";
    END IF;
  END $$;

  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'cookie_consent_optional_categories_tools'
    ) THEN
      INSERT INTO "cookie_consent_optional_category_settings_functional_tools" ("order", "parent_id", "value")
      SELECT
        "tools"."order",
        "categories"."_parent_id",
        ("tools"."value"::text)::"enum_cookie_consent_optional_category_settings_functional_tools"
      FROM "cookie_consent_optional_categories_tools" AS "tools"
      INNER JOIN "cookie_consent_optional_categories" AS "categories" ON "categories"."id" = "tools"."parent_id"
      WHERE "categories"."key" = 'functional';

      INSERT INTO "cookie_consent_optional_category_settings_analytics_tools" ("order", "parent_id", "value")
      SELECT
        "tools"."order",
        "categories"."_parent_id",
        ("tools"."value"::text)::"enum_cookie_consent_optional_category_settings_analytics_tools"
      FROM "cookie_consent_optional_categories_tools" AS "tools"
      INNER JOIN "cookie_consent_optional_categories" AS "categories" ON "categories"."id" = "tools"."parent_id"
      WHERE "categories"."key" = 'analytics';

      INSERT INTO "cookie_consent_optional_category_settings_marketing_tools" ("order", "parent_id", "value")
      SELECT
        "tools"."order",
        "categories"."_parent_id",
        ("tools"."value"::text)::"enum_cookie_consent_optional_category_settings_marketing_tools"
      FROM "cookie_consent_optional_categories_tools" AS "tools"
      INNER JOIN "cookie_consent_optional_categories" AS "categories" ON "categories"."id" = "tools"."parent_id"
      WHERE "categories"."key" = 'marketing';
    ELSE
      INSERT INTO "cookie_consent_optional_category_settings_functional_tools" ("order", "parent_id", "value")
      SELECT 0, "id", 'openstreetmap'::"enum_cookie_consent_optional_category_settings_functional_tools"
      FROM "cookie_consent";

      INSERT INTO "cookie_consent_optional_category_settings_analytics_tools" ("order", "parent_id", "value")
      SELECT 0, "id", 'posthog'::"enum_cookie_consent_optional_category_settings_analytics_tools"
      FROM "cookie_consent";
    END IF;
  END $$;

  ALTER TABLE "cookie_consent_optional_category_settings_functional_tools" ADD CONSTRAINT "cookie_consent_optional_category_settings_functional_tools_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."cookie_consent"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cookie_consent_optional_category_settings_analytics_tools" ADD CONSTRAINT "cookie_consent_optional_category_settings_analytics_tools_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."cookie_consent"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cookie_consent_optional_category_settings_marketing_tools" ADD CONSTRAINT "cookie_consent_optional_category_settings_marketing_tools_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."cookie_consent"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cookie_consent_optional_category_settings_functional_tools_order_idx" ON "cookie_consent_optional_category_settings_functional_tools" USING btree ("order");
  CREATE INDEX "cookie_consent_optional_category_settings_functional_tools_parent_idx" ON "cookie_consent_optional_category_settings_functional_tools" USING btree ("parent_id");
  CREATE INDEX "cookie_consent_optional_category_settings_analytics_tools_order_idx" ON "cookie_consent_optional_category_settings_analytics_tools" USING btree ("order");
  CREATE INDEX "cookie_consent_optional_category_settings_analytics_tools_parent_idx" ON "cookie_consent_optional_category_settings_analytics_tools" USING btree ("parent_id");
  CREATE INDEX "cookie_consent_optional_category_settings_marketing_tools_order_idx" ON "cookie_consent_optional_category_settings_marketing_tools" USING btree ("order");
  CREATE INDEX "cookie_consent_optional_category_settings_marketing_tools_parent_idx" ON "cookie_consent_optional_category_settings_marketing_tools" USING btree ("parent_id");
  ALTER TABLE "cookie_consent" DROP COLUMN IF EXISTS "privacy_policy_url";
  DROP TABLE IF EXISTS "cookie_consent_optional_categories_tools" CASCADE;
  DROP TABLE IF EXISTS "cookie_consent_optional_categories" CASCADE;
  DROP TYPE IF EXISTS "public"."enum_cookie_consent_optional_categories_tools";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE "cookie_consent_optional_categories" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"description" varchar NOT NULL
  );

  INSERT INTO "cookie_consent_optional_categories" ("_order", "_parent_id", "id", "key", "label", "description")
  SELECT
    0,
    "id",
    concat("id", '_functional'),
    'functional',
    COALESCE(NULLIF("optional_category_settings_functional_label", ''), 'Functional cookies'),
    'Remember helpful preferences and support a smoother experience.'
  FROM "cookie_consent";

  INSERT INTO "cookie_consent_optional_categories" ("_order", "_parent_id", "id", "key", "label", "description")
  SELECT
    1,
    "id",
    concat("id", '_analytics'),
    'analytics',
    COALESCE(NULLIF("optional_category_settings_analytics_label", ''), 'Analytics cookies'),
    'Help us understand how the site is used so we can improve it.'
  FROM "cookie_consent";
  ALTER TABLE "cookie_consent_optional_categories" ADD CONSTRAINT "cookie_consent_optional_categories_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cookie_consent"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cookie_consent_optional_categories_order_idx" ON "cookie_consent_optional_categories" USING btree ("_order");
  CREATE INDEX "cookie_consent_optional_categories_parent_id_idx" ON "cookie_consent_optional_categories" USING btree ("_parent_id");
  ALTER TABLE "cookie_consent" ADD COLUMN "privacy_policy_url" varchar DEFAULT '/privacy-policy' NOT NULL;
  DROP TABLE "cookie_consent_optional_category_settings_functional_tools" CASCADE;
  DROP TABLE "cookie_consent_optional_category_settings_analytics_tools" CASCADE;
  DROP TABLE "cookie_consent_optional_category_settings_marketing_tools" CASCADE;
  UPDATE "cookie_consent"
  SET "consent_version" = 2;
  INSERT INTO "cookie_consent_optional_categories" ("_order", "_parent_id", "id", "key", "label", "description")
  SELECT
    2,
    "id",
    concat("id", '_marketing'),
    'marketing',
    COALESCE(NULLIF("optional_category_settings_marketing_label", ''), 'Marketing cookies'),
    'Support campaign measurement and more relevant marketing communication.'
  FROM "cookie_consent";
  ALTER TABLE "cookie_consent" DROP COLUMN "optional_category_settings_functional_enabled";
  ALTER TABLE "cookie_consent" DROP COLUMN "optional_category_settings_functional_label";
  ALTER TABLE "cookie_consent" DROP COLUMN "optional_category_settings_analytics_enabled";
  ALTER TABLE "cookie_consent" DROP COLUMN "optional_category_settings_analytics_label";
  ALTER TABLE "cookie_consent" DROP COLUMN "optional_category_settings_marketing_enabled";
  ALTER TABLE "cookie_consent" DROP COLUMN "optional_category_settings_marketing_label";
  DROP TYPE "public"."enum_cookie_consent_optional_category_settings_functional_tools";
  DROP TYPE "public"."enum_cookie_consent_optional_category_settings_analytics_tools";
  DROP TYPE "public"."enum_cookie_consent_optional_category_settings_marketing_tools";`)
}
