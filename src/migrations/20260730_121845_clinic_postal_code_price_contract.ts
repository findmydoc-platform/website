import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinics"
     ALTER COLUMN "address_zip_code" SET DATA TYPE varchar
     USING "address_zip_code"::text;

   WITH "normalized_prices" AS (
     UPDATE "clinictreatments"
     SET "price" = ROUND(GREATEST("price", 0), 2)
     WHERE "price" < 0
        OR "price" <> ROUND("price", 2)
     RETURNING "treatment_id"
   ),
   "affected_treatments" AS (
     SELECT DISTINCT "treatment_id"
     FROM "normalized_prices"
     WHERE "treatment_id" IS NOT NULL
   ),
   "recalculated_prices" AS (
     SELECT "clinictreatments"."treatment_id", AVG("clinictreatments"."price") AS "average_price"
     FROM "clinictreatments"
     INNER JOIN "affected_treatments"
       ON "affected_treatments"."treatment_id" = "clinictreatments"."treatment_id"
     WHERE "clinictreatments"."active" = true
     GROUP BY "clinictreatments"."treatment_id"
   )
   UPDATE "treatments"
   SET "average_price" = "recalculated_prices"."average_price",
       "updated_at" = now()
   FROM "recalculated_prices"
   WHERE "treatments"."id" = "recalculated_prices"."treatment_id";`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error('This migration is forward-only because converting postal codes back to numbers would lose data.')
}
