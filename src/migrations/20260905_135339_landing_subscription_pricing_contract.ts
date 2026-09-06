import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "landing_pages_clinic_partners_pricing_plans_highlights";
  DROP TABLE "landing_pages_clinic_partners_pricing_plans";
  DROP TABLE "landing_pages_clinic_partners_pricing_model";
  ALTER TABLE "landing_pages" DROP COLUMN "clinic_partners_pricing_title";
  ALTER TABLE "landing_pages" DROP COLUMN "clinic_partners_pricing_description";
  DROP TYPE "public"."enum_landing_pages_clinic_partners_pricing_plans_layout";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $migration$
   BEGIN
     RAISE EXCEPTION 'Cannot roll back the landing subscription pricing contract because the pricing storage was permanently deleted. Restore from a pre-contract backup or roll forward.';
   END
   $migration$;`)
}
