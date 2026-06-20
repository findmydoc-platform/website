import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "landing_pages" ADD COLUMN "clinic_partners_registration_intro_title" varchar DEFAULT 'Ready for verified visibility?' NOT NULL;
  ALTER TABLE "landing_pages" ADD COLUMN "clinic_partners_registration_intro_description" varchar DEFAULT 'Share the key details. We review your request personally and follow up with the next steps.' NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_registration_intro_title" DROP DEFAULT;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_registration_intro_description" DROP DEFAULT;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "landing_pages" DROP COLUMN "clinic_partners_registration_intro_title";
  ALTER TABLE "landing_pages" DROP COLUMN "clinic_partners_registration_intro_description";`)
}
