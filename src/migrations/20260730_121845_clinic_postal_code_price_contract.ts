import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinics"
     ALTER COLUMN "address_zip_code" SET DATA TYPE varchar
     USING "address_zip_code"::text;

   UPDATE "clinictreatments"
   SET "price" = ROUND(GREATEST("price", 0), 2)
   WHERE "price" < 0
      OR "price" <> ROUND("price", 2);`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error('This migration is forward-only because converting postal codes back to numbers would lose data.')
}
