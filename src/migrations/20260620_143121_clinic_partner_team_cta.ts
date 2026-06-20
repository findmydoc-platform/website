import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_landing_pages_clinic_partners_team_cta_link_type" AS ENUM('reference', 'custom');
  ALTER TABLE "landing_pages" ADD COLUMN "clinic_partners_team_cta_button_text" varchar DEFAULT 'About us' NOT NULL;
  ALTER TABLE "landing_pages" ADD COLUMN "clinic_partners_team_cta_link_type" "enum_landing_pages_clinic_partners_team_cta_link_type" DEFAULT 'custom';
  ALTER TABLE "landing_pages" ADD COLUMN "clinic_partners_team_cta_link_new_tab" boolean;
  ALTER TABLE "landing_pages" ADD COLUMN "clinic_partners_team_cta_link_url" varchar DEFAULT '/about';
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_team_cta_button_text" DROP DEFAULT;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_team_cta_link_type" SET DEFAULT 'reference';
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_team_cta_link_url" DROP DEFAULT;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "landing_pages" DROP COLUMN "clinic_partners_team_cta_button_text";
  ALTER TABLE "landing_pages" DROP COLUMN "clinic_partners_team_cta_link_type";
  ALTER TABLE "landing_pages" DROP COLUMN "clinic_partners_team_cta_link_new_tab";
  ALTER TABLE "landing_pages" DROP COLUMN "clinic_partners_team_cta_link_url";
  DROP TYPE "public"."enum_landing_pages_clinic_partners_team_cta_link_type";`)
}
