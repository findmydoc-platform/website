import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "platform_content_media" ALTER COLUMN "created_by_id" DROP NOT NULL;
  ALTER TABLE "clinic_media" ALTER COLUMN "created_by_id" DROP NOT NULL;
  ALTER TABLE "clinic_gallery_media" ALTER COLUMN "created_by_id" DROP NOT NULL;
  ALTER TABLE "clinic_gallery_entries" ALTER COLUMN "created_by_id" DROP NOT NULL;
  ALTER TABLE "doctor_media" ALTER COLUMN "created_by_id" DROP NOT NULL;
  ALTER TABLE "user_profile_media" DROP COLUMN "alt";
  ALTER TABLE "user_profile_media" DROP COLUMN "caption";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "platform_content_media" ALTER COLUMN "created_by_id" SET NOT NULL;
  ALTER TABLE "clinic_media" ALTER COLUMN "created_by_id" SET NOT NULL;
  ALTER TABLE "clinic_gallery_media" ALTER COLUMN "created_by_id" SET NOT NULL;
  ALTER TABLE "clinic_gallery_entries" ALTER COLUMN "created_by_id" SET NOT NULL;
  ALTER TABLE "doctor_media" ALTER COLUMN "created_by_id" SET NOT NULL;
  ALTER TABLE "user_profile_media" ADD COLUMN "alt" varchar NOT NULL;
  ALTER TABLE "user_profile_media" ADD COLUMN "caption" jsonb;`)
}
