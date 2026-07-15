import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   -- Retain the removed pricing storage until the separately approved contract migration.
  -- New landing-page seeds no longer provide these fields, so they must be nullable.
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_pricing_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_pricing_description" DROP NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $migration$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM "landing_pages"
      WHERE "clinic_partners_pricing_title" IS NULL
        OR "clinic_partners_pricing_description" IS NULL
    ) THEN
      RAISE EXCEPTION 'Cannot restore pricing constraints while landing pages contain null pricing fields.';
    END IF;
  END
  $migration$;

  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_pricing_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_pricing_description" SET NOT NULL;`)
}
