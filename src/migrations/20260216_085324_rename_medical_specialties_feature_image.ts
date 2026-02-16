import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Manual adjustment: removed unrelated exports.format alteration caused by local schema drift.
  await db.execute(sql`
   ALTER TABLE "medical_specialties" DROP CONSTRAINT "medical_specialties_icon_id_platform_content_media_id_fk";
  
  DROP INDEX "medical_specialties_icon_idx";
  ALTER TABLE "medical_specialties" ADD COLUMN "feature_image_id" integer;
  ALTER TABLE "medical_specialties" ADD CONSTRAINT "medical_specialties_feature_image_id_platform_content_media_id_fk" FOREIGN KEY ("feature_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "medical_specialties_feature_image_idx" ON "medical_specialties" USING btree ("feature_image_id");
  ALTER TABLE "medical_specialties" DROP COLUMN "icon_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Manual adjustment mirrors up(): only revert medical_specialties icon/feature image columns.
  await db.execute(sql`
   ALTER TABLE "medical_specialties" DROP CONSTRAINT "medical_specialties_feature_image_id_platform_content_media_id_fk";
  
  DROP INDEX "medical_specialties_feature_image_idx";
  ALTER TABLE "medical_specialties" ADD COLUMN "icon_id" integer;
  ALTER TABLE "medical_specialties" ADD CONSTRAINT "medical_specialties_icon_id_platform_content_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "medical_specialties_icon_idx" ON "medical_specialties" USING btree ("icon_id");
  ALTER TABLE "medical_specialties" DROP COLUMN "feature_image_id";`)
}
