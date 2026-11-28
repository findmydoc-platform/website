import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_clinic_applications_mcp_onboarding_staff_mode" AS ENUM('new_account', 'existing_account');
  ALTER TABLE "clinic_applications" ADD COLUMN "mcp_onboarding_request_key" varchar;
  ALTER TABLE "clinic_applications" ADD COLUMN "mcp_onboarding_staff_mode" "enum_clinic_applications_mcp_onboarding_staff_mode";
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "clinic_onboarding_read" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "clinic_onboarding_create" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "clinic_onboarding_correct" boolean DEFAULT false;
  CREATE UNIQUE INDEX "clinic_applications_mcp_onboarding_request_key_idx" ON "clinic_applications" USING btree ("mcp_onboarding_request_key");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "clinic_applications_mcp_onboarding_request_key_idx";
  ALTER TABLE "clinic_applications" DROP COLUMN "mcp_onboarding_request_key";
  ALTER TABLE "clinic_applications" DROP COLUMN "mcp_onboarding_staff_mode";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "clinic_onboarding_read";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "clinic_onboarding_create";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "clinic_onboarding_correct";
  DROP TYPE "public"."enum_clinic_applications_mcp_onboarding_staff_mode";`)
}
