import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "_pages_v" ADD COLUMN "version_deleted_at" timestamp(3) with time zone;
  ALTER TABLE "posts" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "_posts_v" ADD COLUMN "version_deleted_at" timestamp(3) with time zone;
  ALTER TABLE "media" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "clinics" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "doctors" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "medical_specialties" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "treatments" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "reviews" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "tags" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  CREATE INDEX "pages_deleted_at_idx" ON "pages" USING btree ("deleted_at");
  CREATE INDEX "_pages_v_version_version_deleted_at_idx" ON "_pages_v" USING btree ("version_deleted_at");
  CREATE INDEX "posts_deleted_at_idx" ON "posts" USING btree ("deleted_at");
  CREATE INDEX "_posts_v_version_version_deleted_at_idx" ON "_posts_v" USING btree ("version_deleted_at");
  CREATE INDEX "media_deleted_at_idx" ON "media" USING btree ("deleted_at");
  CREATE INDEX "clinics_deleted_at_idx" ON "clinics" USING btree ("deleted_at");
  CREATE INDEX "doctors_deleted_at_idx" ON "doctors" USING btree ("deleted_at");
  CREATE INDEX "medical_specialties_deleted_at_idx" ON "medical_specialties" USING btree ("deleted_at");
  CREATE INDEX "treatments_deleted_at_idx" ON "treatments" USING btree ("deleted_at");
  CREATE INDEX "reviews_deleted_at_idx" ON "reviews" USING btree ("deleted_at");
  CREATE INDEX "tags_deleted_at_idx" ON "tags" USING btree ("deleted_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "pages_deleted_at_idx";
  DROP INDEX "_pages_v_version_version_deleted_at_idx";
  DROP INDEX "posts_deleted_at_idx";
  DROP INDEX "_posts_v_version_version_deleted_at_idx";
  DROP INDEX "media_deleted_at_idx";
  DROP INDEX "clinics_deleted_at_idx";
  DROP INDEX "doctors_deleted_at_idx";
  DROP INDEX "medical_specialties_deleted_at_idx";
  DROP INDEX "treatments_deleted_at_idx";
  DROP INDEX "reviews_deleted_at_idx";
  DROP INDEX "tags_deleted_at_idx";
  ALTER TABLE "pages" DROP COLUMN "deleted_at";
  ALTER TABLE "_pages_v" DROP COLUMN "version_deleted_at";
  ALTER TABLE "posts" DROP COLUMN "deleted_at";
  ALTER TABLE "_posts_v" DROP COLUMN "version_deleted_at";
  ALTER TABLE "media" DROP COLUMN "deleted_at";
  ALTER TABLE "clinics" DROP COLUMN "deleted_at";
  ALTER TABLE "doctors" DROP COLUMN "deleted_at";
  ALTER TABLE "medical_specialties" DROP COLUMN "deleted_at";
  ALTER TABLE "treatments" DROP COLUMN "deleted_at";
  ALTER TABLE "reviews" DROP COLUMN "deleted_at";
  ALTER TABLE "tags" DROP COLUMN "deleted_at";`)
}
