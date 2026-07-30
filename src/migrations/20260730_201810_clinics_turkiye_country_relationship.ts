import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinics" ADD COLUMN "address_country_id" integer;
  ALTER TABLE "search" ADD COLUMN "country_id" integer;

  UPDATE "clinics"
  SET "address_country_id" = "turkiye"."id"
  FROM (
    SELECT "id"
    FROM "countries"
    WHERE UPPER(BTRIM("iso_code")) = 'TR'
    ORDER BY "id"
    LIMIT 1
  ) AS "turkiye"
  WHERE "clinics"."address_country_id" IS NULL
    AND "clinics"."address_country" = 'Turkey';

  UPDATE "search"
  SET "country_id" = "turkiye"."id"
  FROM (
    SELECT "id"
    FROM "countries"
    WHERE UPPER(BTRIM("iso_code")) = 'TR'
    ORDER BY "id"
    LIMIT 1
  ) AS "turkiye"
  WHERE "search"."country_id" IS NULL
    AND "search"."country" = 'Turkey';

  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM "clinics"
      WHERE "address_country" = 'Turkey'
        AND "address_country_id" IS NULL
    ) THEN
      RAISE EXCEPTION 'Cannot map clinic country Turkey to Countries ISO TR';
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
  ALTER TABLE "clinics" DROP COLUMN "address_country_id";
  ALTER TABLE "search" DROP COLUMN "country_id";`)
}
