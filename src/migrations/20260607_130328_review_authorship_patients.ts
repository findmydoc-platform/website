import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_reviews_author_visibility" AS ENUM('anonymous', 'firstNameInitial');
  ALTER TABLE "reviews" DROP CONSTRAINT "reviews_patient_id_platform_staff_id_fk";

  ALTER TABLE "patients" ADD COLUMN "stable_id" varchar;
  ALTER TABLE "reviews" ADD COLUMN "author_visibility" "enum_reviews_author_visibility" DEFAULT 'anonymous' NOT NULL;
  ALTER TABLE "reviews" ADD COLUMN "public_author_name" varchar;
  ALTER TABLE "reviews" ALTER COLUMN "patient_id" DROP NOT NULL;
  UPDATE "reviews" SET "patient_id" = NULL, "author_visibility" = 'anonymous', "public_author_name" = NULL;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "patients_stable_id_idx" ON "patients" USING btree ("stable_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM "reviews") THEN
      RAISE EXCEPTION 'Cannot roll back review authorship migration while reviews exist. Review patient authorship cannot be represented in the previous platformStaff author schema.';
    END IF;
  END $$;
  ALTER TABLE "reviews" DROP CONSTRAINT "reviews_patient_id_patients_id_fk";

  DROP INDEX "patients_stable_id_idx";
  ALTER TABLE "reviews" ALTER COLUMN "patient_id" SET NOT NULL;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_patient_id_platform_staff_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."platform_staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "patients" DROP COLUMN "stable_id";
  ALTER TABLE "reviews" DROP COLUMN "author_visibility";
  ALTER TABLE "reviews" DROP COLUMN "public_author_name";
  DROP TYPE "public"."enum_reviews_author_visibility";`)
}
