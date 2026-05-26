import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinic_applications" ADD COLUMN "website_or_public_profile" varchar;
  ALTER TABLE "clinic_applications" ADD COLUMN "privacy_notice_acknowledged_at" timestamp(3) with time zone;
  ALTER TABLE "clinic_applications" ADD COLUMN "privacy_notice_url" varchar;
  CREATE INDEX "clinic_applications_website_or_public_profile_idx" ON "clinic_applications" USING btree ("website_or_public_profile");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "clinic_applications_website_or_public_profile_idx";
  ALTER TABLE "clinic_applications" DROP COLUMN "website_or_public_profile";
  ALTER TABLE "clinic_applications" DROP COLUMN "privacy_notice_acknowledged_at";
  ALTER TABLE "clinic_applications" DROP COLUMN "privacy_notice_url";`)
}
