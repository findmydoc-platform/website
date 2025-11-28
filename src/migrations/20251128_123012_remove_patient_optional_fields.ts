import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "patients" DROP CONSTRAINT "patients_country_id_countries_id_fk";
  
  ALTER TABLE "patients" DROP CONSTRAINT "patients_profile_image_id_user_profile_media_id_fk";
  
  DROP INDEX "patients_country_idx";
  DROP INDEX "patients_profile_image_idx";
  ALTER TABLE "patients" DROP COLUMN "date_of_birth";
  ALTER TABLE "patients" DROP COLUMN "gender";
  ALTER TABLE "patients" DROP COLUMN "phone_number";
  ALTER TABLE "patients" DROP COLUMN "address";
  ALTER TABLE "patients" DROP COLUMN "country_id";
  ALTER TABLE "patients" DROP COLUMN "language";
  ALTER TABLE "patients" DROP COLUMN "profile_image_id";
  DROP TYPE "public"."enum_patients_gender";
  DROP TYPE "public"."enum_patients_language";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_patients_gender" AS ENUM('male', 'female', 'other', 'not_specified');
  CREATE TYPE "public"."enum_patients_language" AS ENUM('en', 'de', 'fr', 'es', 'ar', 'ru', 'zh');
  ALTER TABLE "patients" ADD COLUMN "date_of_birth" timestamp(3) with time zone;
  ALTER TABLE "patients" ADD COLUMN "gender" "enum_patients_gender";
  ALTER TABLE "patients" ADD COLUMN "phone_number" varchar;
  ALTER TABLE "patients" ADD COLUMN "address" varchar;
  ALTER TABLE "patients" ADD COLUMN "country_id" integer;
  ALTER TABLE "patients" ADD COLUMN "language" "enum_patients_language" DEFAULT 'en';
  ALTER TABLE "patients" ADD COLUMN "profile_image_id" integer;
  ALTER TABLE "patients" ADD CONSTRAINT "patients_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "patients" ADD CONSTRAINT "patients_profile_image_id_user_profile_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."user_profile_media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "patients_country_idx" ON "patients" USING btree ("country_id");
  CREATE INDEX "patients_profile_image_idx" ON "patients" USING btree ("profile_image_id");`)
}
