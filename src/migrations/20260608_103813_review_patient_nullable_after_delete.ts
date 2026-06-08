import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "reviews" ALTER COLUMN "patient_id" DROP NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM "reviews" WHERE "patient_id" IS NULL) THEN
      RAISE EXCEPTION 'Cannot roll back nullable review patient relation while reviews have no patient author.';
    END IF;
  END $$;
  ALTER TABLE "reviews" ALTER COLUMN "patient_id" SET NOT NULL;`)
}
