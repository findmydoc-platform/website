import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinic_gallery_media" RENAME COLUMN "caption" TO "description";
  ALTER TABLE "clinic_gallery_entries" RENAME COLUMN "caption" TO "description";
  ALTER TABLE "clinic_gallery_entries" DROP CONSTRAINT "clinic_gallery_entries_single_media_id_clinic_gallery_media_id_fk";

  ALTER TABLE "clinic_gallery_entries" DROP CONSTRAINT "clinic_gallery_entries_treatment_id_treatments_id_fk";

  DROP INDEX "clinic_gallery_entries_single_media_idx";
  DROP INDEX "clinic_gallery_entries_treatment_idx";
  ALTER TABLE "clinic_gallery_entries" ALTER COLUMN "before_media_id" SET NOT NULL;
  ALTER TABLE "clinic_gallery_entries" ALTER COLUMN "after_media_id" SET NOT NULL;
  ALTER TABLE "clinic_gallery_media" ADD COLUMN "storage_key" varchar NOT NULL;
  ALTER TABLE "clinic_gallery_entries" ADD COLUMN "title" varchar NOT NULL;
  ALTER TABLE "clinic_gallery_media" DROP COLUMN "pair_role";
  ALTER TABLE "clinic_gallery_media" DROP COLUMN "pair_group_id";
  ALTER TABLE "clinic_gallery_media" DROP COLUMN "consent_granted";
  ALTER TABLE "clinic_gallery_entries" DROP COLUMN "variant";
  ALTER TABLE "clinic_gallery_entries" DROP COLUMN "single_media_id";
  ALTER TABLE "clinic_gallery_entries" DROP COLUMN "treatment_id";
  ALTER TABLE "clinic_gallery_entries" DROP COLUMN "display_order";
  ALTER TABLE "clinic_gallery_entries" DROP COLUMN "consent_reference";
  ALTER TABLE "doctor_media" DROP COLUMN "storage_key";
  DROP TYPE "public"."enum_clinic_gallery_media_pair_role";
  DROP TYPE "public"."enum_clinic_gallery_entries_variant";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_clinic_gallery_media_pair_role" AS ENUM('single', 'before', 'after');
  CREATE TYPE "public"."enum_clinic_gallery_entries_variant" AS ENUM('single', 'pair');
  ALTER TABLE "clinic_gallery_media" RENAME COLUMN "description" TO "caption";
  ALTER TABLE "clinic_gallery_entries" RENAME COLUMN "description" TO "caption";
  ALTER TABLE "clinic_gallery_entries" ALTER COLUMN "before_media_id" DROP NOT NULL;
  ALTER TABLE "clinic_gallery_entries" ALTER COLUMN "after_media_id" DROP NOT NULL;
  ALTER TABLE "clinic_gallery_media" ADD COLUMN "pair_role" "enum_clinic_gallery_media_pair_role" DEFAULT 'single';
  ALTER TABLE "clinic_gallery_media" ADD COLUMN "pair_group_id" varchar;
  ALTER TABLE "clinic_gallery_media" ADD COLUMN "consent_granted" boolean DEFAULT false;
  ALTER TABLE "clinic_gallery_entries" ADD COLUMN "variant" "enum_clinic_gallery_entries_variant" DEFAULT 'single' NOT NULL;
  ALTER TABLE "clinic_gallery_entries" ADD COLUMN "single_media_id" integer;
  ALTER TABLE "clinic_gallery_entries" ADD COLUMN "treatment_id" integer;
  ALTER TABLE "clinic_gallery_entries" ADD COLUMN "display_order" numeric DEFAULT 0;
  ALTER TABLE "clinic_gallery_entries" ADD COLUMN "consent_reference" varchar;
  ALTER TABLE "doctor_media" ADD COLUMN "storage_key" varchar NOT NULL;
  ALTER TABLE "clinic_gallery_entries" ADD CONSTRAINT "clinic_gallery_entries_single_media_id_clinic_gallery_media_id_fk" FOREIGN KEY ("single_media_id") REFERENCES "public"."clinic_gallery_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "clinic_gallery_entries" ADD CONSTRAINT "clinic_gallery_entries_treatment_id_treatments_id_fk" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "clinic_gallery_entries_single_media_idx" ON "clinic_gallery_entries" USING btree ("single_media_id");
  CREATE INDEX "clinic_gallery_entries_treatment_idx" ON "clinic_gallery_entries" USING btree ("treatment_id");
  ALTER TABLE "clinic_gallery_media" DROP COLUMN "storage_key";
  ALTER TABLE "clinic_gallery_entries" DROP COLUMN "title";`)
}
