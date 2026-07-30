import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    WITH "recalculated_prices" AS (
      SELECT
        "treatments"."id" AS "treatment_id",
        AVG("clinictreatments"."price") FILTER (
          WHERE "clinictreatments"."active" = true
        ) AS "average_price"
      FROM "treatments"
      LEFT JOIN "clinictreatments"
        ON "clinictreatments"."treatment_id" = "treatments"."id"
      GROUP BY "treatments"."id"
    )
    UPDATE "treatments"
    SET "average_price" = "recalculated_prices"."average_price",
        "updated_at" = now()
    FROM "recalculated_prices"
    WHERE "treatments"."id" = "recalculated_prices"."treatment_id"
      AND "treatments"."average_price" IS DISTINCT FROM "recalculated_prices"."average_price";
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error('This migration is forward-only because stale treatment averages cannot be reconstructed.')
}
