import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinics" ADD COLUMN "address_country_id" integer;
  ALTER TABLE "search" ADD COLUMN "country_id" integer;

  DO $$
  BEGIN
    IF (
      EXISTS (
        SELECT 1
        FROM "clinics"
        WHERE NULLIF(BTRIM("address_country"), '') IS NOT NULL
          AND "address_country_id" IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM "search"
        WHERE NULLIF(BTRIM("country"), '') IS NOT NULL
          AND "country_id" IS NULL
      )
    ) AND (
      SELECT COUNT(*)
      FROM "countries"
      WHERE UPPER(BTRIM("iso_code")) = 'TR'
    ) <> 1 THEN
      RAISE EXCEPTION 'Expected exactly one Countries record with ISO TR';
    END IF;
  END
  $$;

  UPDATE "countries"
  SET
    "name" = 'Türkiye',
    "iso_code" = 'TR'
  WHERE UPPER(BTRIM("iso_code")) = 'TR';

  UPDATE "clinics"
  SET
    "address_country_id" = "turkiye"."id",
    "address_country" = 'Türkiye'
  FROM (
    SELECT "id"
    FROM "countries"
    WHERE "iso_code" = 'TR'
  ) AS "turkiye"
  WHERE "clinics"."address_country_id" IS NULL
    AND LOWER(BTRIM("clinics"."address_country")) IN ('turkey', 'türkiye');

  UPDATE "search"
  SET
    "country_id" = "turkiye"."id",
    "country" = 'Türkiye'
  FROM (
    SELECT "id"
    FROM "countries"
    WHERE "iso_code" = 'TR'
  ) AS "turkiye"
  WHERE "search"."country_id" IS NULL
    AND LOWER(BTRIM("search"."country")) IN ('turkey', 'türkiye');

  ALTER TABLE "clinics" ALTER COLUMN "address_country" SET DEFAULT 'Türkiye';
  ALTER TABLE "search" ALTER COLUMN "country" SET DEFAULT 'Türkiye';

  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM "clinics"
      WHERE NULLIF(BTRIM("address_country"), '') IS NOT NULL
        AND "address_country_id" IS NULL
    ) THEN
      RAISE EXCEPTION 'Cannot map one or more clinic legacy country values to Countries ISO TR';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "search"
      WHERE NULLIF(BTRIM("country"), '') IS NOT NULL
        AND "country_id" IS NULL
    ) THEN
      RAISE EXCEPTION 'Cannot map one or more search legacy country values to Countries ISO TR';
    END IF;
  END
  $$;

  ALTER TABLE "clinics" ADD CONSTRAINT "clinics_address_country_id_countries_id_fk" FOREIGN KEY ("address_country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "search" ADD CONSTRAINT "search_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "clinics_address_address_country_idx" ON "clinics" USING btree ("address_country_id");
  CREATE INDEX "search_country_idx" ON "search" USING btree ("country_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinics" DROP CONSTRAINT "clinics_address_country_id_countries_id_fk";
  ALTER TABLE "search" DROP CONSTRAINT "search_country_id_countries_id_fk";
  DROP INDEX "clinics_address_address_country_idx";
  DROP INDEX "search_country_idx";
  ALTER TABLE "clinics" ALTER COLUMN "address_country" SET DEFAULT 'Turkey';
  ALTER TABLE "search" ALTER COLUMN "country" SET DEFAULT 'Turkey';
  ALTER TABLE "clinics" DROP COLUMN "address_country_id";
  ALTER TABLE "search" DROP COLUMN "country_id";`)
}
