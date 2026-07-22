import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinic_applications" ALTER COLUMN "provisioning_error_code" SET DATA TYPE text;
  DROP TYPE "public"."enum_clinic_applications_provisioning_error_code";
  CREATE TYPE "public"."enum_clinic_applications_provisioning_error_code" AS ENUM('record_failed', 'auth_failed', 'binding_failed');
  ALTER TABLE "clinic_applications" ALTER COLUMN "provisioning_error_code" SET DATA TYPE "public"."enum_clinic_applications_provisioning_error_code" USING "provisioning_error_code"::"public"."enum_clinic_applications_provisioning_error_code";
  DROP INDEX "clinic_staff_onboarding_key_idx";
  DROP INDEX "clinics_onboarding_key_idx";
  CREATE INDEX "clinic_staff_onboarding_key_idx" ON "clinic_staff" USING btree ("onboarding_key");
  CREATE INDEX "clinics_onboarding_key_idx" ON "clinics" USING btree ("onboarding_key");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Duplicate onboarding records are accepted operational data. Preserve the non-unique indexes so this rollback
  // never requires deleting or merging records merely to recreate a transient uniqueness constraint.
  await db.execute(sql`
   ALTER TYPE "public"."enum_clinic_applications_provisioning_error_code" ADD VALUE 'record_conflict' BEFORE 'auth_failed';`)
}
