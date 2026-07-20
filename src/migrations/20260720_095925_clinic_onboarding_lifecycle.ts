import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_clinic_staff_auth_sync_status" AS ENUM('pending', 'synced', 'failed', 'deleted');
  CREATE TYPE "public"."enum_clinic_staff_auth_sync_error_code" AS ENUM('missing_identity', 'account_update_failed', 'account_delete_failed');
  CREATE TYPE "public"."enum_clinic_applications_provisioning_status" AS ENUM('not_started', 'failed', 'completed');
  CREATE TYPE "public"."enum_clinic_applications_provisioning_error_code" AS ENUM('record_failed', 'record_conflict', 'auth_failed', 'binding_failed');
  ALTER TYPE "public"."enum_clinic_staff_status" ADD VALUE 'disabled';
  ALTER TYPE "public"."enum_clinic_staff_status" ADD VALUE 'offboarded';
  ALTER TABLE "clinics" ALTER COLUMN "address_country" DROP DEFAULT;
  ALTER TABLE "clinics" ALTER COLUMN "address_country" DROP NOT NULL;
  ALTER TABLE "clinics" ALTER COLUMN "address_street" DROP NOT NULL;
  ALTER TABLE "clinics" ALTER COLUMN "address_house_number" DROP NOT NULL;
  ALTER TABLE "clinics" ALTER COLUMN "address_zip_code" DROP NOT NULL;
  ALTER TABLE "clinics" ALTER COLUMN "address_city_id" DROP NOT NULL;
  ALTER TABLE "clinic_staff" ADD COLUMN "onboarding_key" varchar;
  ALTER TABLE "clinic_staff" ADD COLUMN "auth_sync_status" "enum_clinic_staff_auth_sync_status" DEFAULT 'pending';
  ALTER TABLE "clinic_staff" ADD COLUMN "auth_sync_error_code" "enum_clinic_staff_auth_sync_error_code";
  ALTER TABLE "clinic_applications" ADD COLUMN "provisioning_status" "enum_clinic_applications_provisioning_status" DEFAULT 'not_started';
  ALTER TABLE "clinic_applications" ADD COLUMN "provisioning_error_code" "enum_clinic_applications_provisioning_error_code";
  ALTER TABLE "clinics" ADD COLUMN "onboarding_key" varchar;
  UPDATE "clinic_staff"
  SET "auth_sync_status" = 'synced'
  WHERE "auth_sync_status" = 'pending'
    AND "supabase_user_id" IS NOT NULL
    AND "status" IN ('pending', 'approved');
  UPDATE "clinic_applications"
  SET "provisioning_status" = 'completed'
  WHERE "status" = 'approved'
    AND "linked_records_clinic_id" IS NOT NULL
    AND "linked_records_clinic_staff_id" IS NOT NULL;
  CREATE UNIQUE INDEX "clinic_staff_onboarding_key_idx" ON "clinic_staff" USING btree ("onboarding_key");
  CREATE UNIQUE INDEX "clinics_onboarding_key_idx" ON "clinics" USING btree ("onboarding_key");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Runtime-created onboarding records can contain lifecycle states and incomplete addresses that did not exist
  // before this migration. Roll back fail-closed without deleting records or inventing address data.
  await db.execute(sql`
   UPDATE "clinic_staff"
  SET "status" = 'rejected'
  WHERE "status" IN ('disabled', 'offboarded');
  ALTER TABLE "clinic_staff" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "clinic_staff" ALTER COLUMN "status" SET DEFAULT 'pending'::text;
  DROP TYPE "public"."enum_clinic_staff_status";
  CREATE TYPE "public"."enum_clinic_staff_status" AS ENUM('pending', 'approved', 'rejected');
  ALTER TABLE "clinic_staff" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."enum_clinic_staff_status";
  ALTER TABLE "clinic_staff" ALTER COLUMN "status" SET DATA TYPE "public"."enum_clinic_staff_status" USING "status"::"public"."enum_clinic_staff_status";
  DROP INDEX "clinic_staff_onboarding_key_idx";
  DROP INDEX "clinics_onboarding_key_idx";
  ALTER TABLE "clinics" ALTER COLUMN "address_country" SET DEFAULT 'Turkey';
  ALTER TABLE "clinic_staff" DROP COLUMN "onboarding_key";
  ALTER TABLE "clinic_staff" DROP COLUMN "auth_sync_status";
  ALTER TABLE "clinic_staff" DROP COLUMN "auth_sync_error_code";
  ALTER TABLE "clinic_applications" DROP COLUMN "provisioning_status";
  ALTER TABLE "clinic_applications" DROP COLUMN "provisioning_error_code";
  ALTER TABLE "clinics" DROP COLUMN "onboarding_key";
  DROP TYPE "public"."enum_clinic_staff_auth_sync_status";
  DROP TYPE "public"."enum_clinic_staff_auth_sync_error_code";
  DROP TYPE "public"."enum_clinic_applications_provisioning_status";
  DROP TYPE "public"."enum_clinic_applications_provisioning_error_code";`)
}
