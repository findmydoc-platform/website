import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_medical_specialties_icon_key" AS ENUM('fallback', 'dental', 'eye-care', 'hair-restoration', 'dermatology', 'plastic-surgery');
  ALTER TABLE "medical_specialties" ADD COLUMN "icon_key" "enum_medical_specialties_icon_key" DEFAULT 'fallback' NOT NULL;
  UPDATE "medical_specialties"
    SET "icon_key" = 'dental'
    WHERE "name" = 'Dental'
      OR "parent_specialty_id" IN (
        SELECT "id" FROM "medical_specialties" WHERE "name" = 'Dental' AND "parent_specialty_id" IS NULL
      );
  UPDATE "medical_specialties"
    SET "icon_key" = 'eye-care'
    WHERE "name" = 'Eye Care'
      OR "parent_specialty_id" IN (
        SELECT "id" FROM "medical_specialties" WHERE "name" = 'Eye Care' AND "parent_specialty_id" IS NULL
      );
  UPDATE "medical_specialties"
    SET "icon_key" = 'hair-restoration'
    WHERE "name" = 'Hair Restoration'
      OR "parent_specialty_id" IN (
        SELECT "id" FROM "medical_specialties" WHERE "name" = 'Hair Restoration' AND "parent_specialty_id" IS NULL
      );
  UPDATE "medical_specialties"
    SET "icon_key" = 'dermatology'
    WHERE "name" = 'Dermatology'
      OR "parent_specialty_id" IN (
        SELECT "id" FROM "medical_specialties" WHERE "name" = 'Dermatology' AND "parent_specialty_id" IS NULL
      );
  UPDATE "medical_specialties"
    SET "icon_key" = 'plastic-surgery'
    WHERE "name" = 'Plastic Surgery'
      OR "parent_specialty_id" IN (
        SELECT "id" FROM "medical_specialties" WHERE "name" = 'Plastic Surgery' AND "parent_specialty_id" IS NULL
      );`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "medical_specialties" DROP COLUMN "icon_key";
  DROP TYPE "public"."enum_medical_specialties_icon_key";`)
}
