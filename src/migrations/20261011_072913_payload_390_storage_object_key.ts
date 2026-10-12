import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "platform_content_media" ADD COLUMN "_objectkey" varchar;
  ALTER TABLE "clinic_media" ADD COLUMN "_objectkey" varchar;
  ALTER TABLE "clinic_gallery_media" ADD COLUMN "_objectkey" varchar;
  ALTER TABLE "doctor_media" ADD COLUMN "_objectkey" varchar;
  ALTER TABLE "user_profile_media" ADD COLUMN "_objectkey" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "platform_content_media" DROP COLUMN "_objectkey";
  ALTER TABLE "clinic_media" DROP COLUMN "_objectkey";
  ALTER TABLE "clinic_gallery_media" DROP COLUMN "_objectkey";
  ALTER TABLE "doctor_media" DROP COLUMN "_objectkey";
  ALTER TABLE "user_profile_media" DROP COLUMN "_objectkey";`)
}
