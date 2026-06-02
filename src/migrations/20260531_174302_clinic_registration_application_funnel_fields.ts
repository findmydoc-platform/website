import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_clinic_applications_contact_role" AS ENUM('Medical Director', 'Clinic Management', 'International Office');
  CREATE TABLE "clinic_applications_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"medical_specialties_id" integer
  );
  
  DROP INDEX "clinic_applications_website_or_public_profile_idx";
  ALTER TABLE "clinic_applications" ALTER COLUMN "contact_first_name" DROP NOT NULL;
  ALTER TABLE "clinic_applications" ADD COLUMN "contact_role" "enum_clinic_applications_contact_role";
  ALTER TABLE "clinic_applications" ADD COLUMN "clinic_website" varchar;
  UPDATE "clinic_applications"
    SET "contact_role" = 'Clinic Management'
    WHERE "contact_role" IS NULL;
  UPDATE "clinic_applications"
    SET "clinic_website" = COALESCE(NULLIF("website_or_public_profile", ''), 'https://legacy-clinic-application.invalid/')
    WHERE "clinic_website" IS NULL;
  ALTER TABLE "clinic_applications" ALTER COLUMN "contact_role" SET NOT NULL;
  ALTER TABLE "clinic_applications" ALTER COLUMN "clinic_website" SET NOT NULL;
  ALTER TABLE "clinic_applications_rels" ADD CONSTRAINT "clinic_applications_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."clinic_applications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clinic_applications_rels" ADD CONSTRAINT "clinic_applications_rels_medical_specialties_fk" FOREIGN KEY ("medical_specialties_id") REFERENCES "public"."medical_specialties"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "clinic_applications_rels_order_idx" ON "clinic_applications_rels" USING btree ("order");
  CREATE INDEX "clinic_applications_rels_parent_idx" ON "clinic_applications_rels" USING btree ("parent_id");
  CREATE INDEX "clinic_applications_rels_path_idx" ON "clinic_applications_rels" USING btree ("path");
  CREATE INDEX "clinic_applications_rels_medical_specialties_id_idx" ON "clinic_applications_rels" USING btree ("medical_specialties_id");
  CREATE INDEX "clinic_applications_clinic_website_idx" ON "clinic_applications" USING btree ("clinic_website");
  ALTER TABLE "clinic_applications" DROP COLUMN "contact_phone";
  ALTER TABLE "clinic_applications" DROP COLUMN "website_or_public_profile";
  ALTER TABLE "clinic_applications" DROP COLUMN "address_street";
  ALTER TABLE "clinic_applications" DROP COLUMN "address_house_number";
  ALTER TABLE "clinic_applications" DROP COLUMN "address_zip_code";
  ALTER TABLE "clinic_applications" DROP COLUMN "address_city";
  ALTER TABLE "clinic_applications" DROP COLUMN "address_country";
  ALTER TABLE "clinic_applications" DROP COLUMN "additional_notes";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinic_applications_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "clinic_applications_rels" CASCADE;
  DROP INDEX "clinic_applications_clinic_website_idx";
  UPDATE "clinic_applications"
    SET "contact_first_name" = ''
    WHERE "contact_first_name" IS NULL;
  ALTER TABLE "clinic_applications" ALTER COLUMN "contact_first_name" SET NOT NULL;
  ALTER TABLE "clinic_applications" ADD COLUMN "contact_phone" varchar;
  ALTER TABLE "clinic_applications" ADD COLUMN "website_or_public_profile" varchar;
  UPDATE "clinic_applications"
    SET "website_or_public_profile" = "clinic_website"
    WHERE "website_or_public_profile" IS NULL;
  ALTER TABLE "clinic_applications" ADD COLUMN "address_street" varchar;
  ALTER TABLE "clinic_applications" ADD COLUMN "address_house_number" varchar;
  ALTER TABLE "clinic_applications" ADD COLUMN "address_zip_code" numeric;
  ALTER TABLE "clinic_applications" ADD COLUMN "address_city" varchar;
  ALTER TABLE "clinic_applications" ADD COLUMN "address_country" varchar DEFAULT 'Turkey';
  UPDATE "clinic_applications"
    SET
      "address_street" = 'Legacy address unavailable',
      "address_house_number" = '',
      "address_zip_code" = 0,
      "address_city" = 'Unknown',
      "address_country" = COALESCE("address_country", 'Turkey')
    WHERE "address_street" IS NULL
      OR "address_house_number" IS NULL
      OR "address_zip_code" IS NULL
      OR "address_city" IS NULL
      OR "address_country" IS NULL;
  ALTER TABLE "clinic_applications" ALTER COLUMN "address_street" SET NOT NULL;
  ALTER TABLE "clinic_applications" ALTER COLUMN "address_house_number" SET NOT NULL;
  ALTER TABLE "clinic_applications" ALTER COLUMN "address_zip_code" SET NOT NULL;
  ALTER TABLE "clinic_applications" ALTER COLUMN "address_city" SET NOT NULL;
  ALTER TABLE "clinic_applications" ALTER COLUMN "address_country" SET NOT NULL;
  ALTER TABLE "clinic_applications" ADD COLUMN "additional_notes" varchar;
  CREATE INDEX "clinic_applications_website_or_public_profile_idx" ON "clinic_applications" USING btree ("website_or_public_profile");
  ALTER TABLE "clinic_applications" DROP COLUMN "contact_role";
  ALTER TABLE "clinic_applications" DROP COLUMN "clinic_website";
  DROP TYPE "public"."enum_clinic_applications_contact_role";`)
}
