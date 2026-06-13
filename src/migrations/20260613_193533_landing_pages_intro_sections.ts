import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "landing_pages" ADD COLUMN "home_testimonials_intro_title" varchar DEFAULT 'Expert feedback' NOT NULL;
  ALTER TABLE "landing_pages" ADD COLUMN "home_testimonials_intro_description" varchar DEFAULT 'Perspectives from healthcare and product experts who reviewed the patient decision flow.' NOT NULL;
  ALTER TABLE "landing_pages" ADD COLUMN "clinic_partners_team_intro_title" varchar DEFAULT 'Our Team' NOT NULL;
  ALTER TABLE "landing_pages" ADD COLUMN "clinic_partners_team_intro_description" varchar DEFAULT 'We are a multidisciplinary team with backgrounds in healthcare, international patient management, medical marketing, and platform technology. Our focus is simple: helping clinics gain international patients in a sustainable, ethical, and measurable way.' NOT NULL;
  ALTER TABLE "landing_pages" ADD COLUMN "clinic_partners_testimonials_intro_title" varchar DEFAULT 'Testimonials' NOT NULL;
  ALTER TABLE "landing_pages" ADD COLUMN "clinic_partners_testimonials_intro_description" varchar DEFAULT 'Feedback from healthcare and clinic growth experts who reviewed the partner onboarding and visibility model.' NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_testimonials_intro_title" DROP DEFAULT;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_testimonials_intro_description" DROP DEFAULT;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_team_intro_title" DROP DEFAULT;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_team_intro_description" DROP DEFAULT;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_testimonials_intro_title" DROP DEFAULT;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_testimonials_intro_description" DROP DEFAULT;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "landing_pages" DROP COLUMN "home_testimonials_intro_title";
  ALTER TABLE "landing_pages" DROP COLUMN "home_testimonials_intro_description";
  ALTER TABLE "landing_pages" DROP COLUMN "clinic_partners_team_intro_title";
  ALTER TABLE "landing_pages" DROP COLUMN "clinic_partners_team_intro_description";
  ALTER TABLE "landing_pages" DROP COLUMN "clinic_partners_testimonials_intro_title";
  ALTER TABLE "landing_pages" DROP COLUMN "clinic_partners_testimonials_intro_description";`)
}
