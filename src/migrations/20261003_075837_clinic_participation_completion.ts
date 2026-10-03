import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_clinic_staff_account_completion_source" AS ENUM('initial-password', 'legacy-password-login', 'legacy-audit');
  CREATE TYPE "public"."enum_clinics_participation_status" AS ENUM('pending', 'approved', 'disabled', 'rejected');
  ALTER TABLE "clinic_staff" ADD COLUMN "account_completion_source" "enum_clinic_staff_account_completion_source";
  ALTER TABLE "clinic_staff" ADD COLUMN "account_completion_subject" varchar;
  ALTER TABLE "clinic_staff" ADD COLUMN "account_completion_clinic_id" varchar;
  ALTER TABLE "clinic_staff" ADD COLUMN "account_completion_evidence_at" timestamp(3) with time zone;
  ALTER TABLE "clinic_staff" ADD COLUMN "account_completion_observed_at" timestamp(3) with time zone;
  ALTER TABLE "clinic_staff" ADD COLUMN "account_completion_auth_action_id" varchar;
  ALTER TABLE "clinic_staff" ADD COLUMN "legacy_access_eligible_at" timestamp(3) with time zone;
  ALTER TABLE "clinic_staff" ADD COLUMN "legacy_access_subject" varchar;
  ALTER TABLE "clinic_staff" ADD COLUMN "legacy_access_clinic_id" varchar;
  ALTER TABLE "clinic_staff" ADD COLUMN "legacy_access_initial_participant" boolean DEFAULT false;
  ALTER TABLE "clinic_staff" ADD COLUMN "invitation_attempted_at" timestamp(3) with time zone;
  ALTER TABLE "clinic_staff" ADD COLUMN "provisioning_identity" varchar;
  ALTER TABLE "clinics" ADD COLUMN "participation_status" "enum_clinics_participation_status";
  ALTER TABLE "clinics" ADD COLUMN "provisioning_identity" varchar;
  CREATE UNIQUE INDEX "clinic_staff_provisioning_identity_idx" ON "clinic_staff" USING btree ("provisioning_identity");
  CREATE INDEX "clinics_participation_status_idx" ON "clinics" USING btree ("participation_status");
  CREATE UNIQUE INDEX "clinics_provisioning_identity_idx" ON "clinics" USING btree ("provisioning_identity");`)
  // Freeze the historical selection to this schema. Runtime collections may contain later columns.
  // This records existing authorization only, never password completion.
  await db.execute(sql`
    UPDATE "clinic_staff" AS staff
    SET "legacy_access_eligible_at" = statement_timestamp(),
        "legacy_access_subject" = staff."supabase_user_id",
        "legacy_access_clinic_id" = clinic."id"::text,
        "legacy_access_initial_participant" = COALESCE((
          SELECT count(*) = 1
            AND bool_and(staff."onboarding_key" = 'clinic-application:' || application."id"::text)
            AND clinic."onboarding_key" = staff."onboarding_key"
          FROM "clinic_applications" AS application
          WHERE application."status" = 'approved'
            AND application."provisioning_status" = 'completed'
            AND application."linked_records_clinic_staff_id" = staff."id"
            AND application."linked_records_clinic_id" = clinic."id"
        ), false),
        "updated_at" = statement_timestamp()
    FROM "clinics" AS clinic
    WHERE staff."clinic_id" = clinic."id"
      AND staff."status" = 'approved'
      AND staff."auth_sync_status" = 'synced'
      AND staff."supabase_user_id" IS NOT NULL
      AND staff."legacy_access_eligible_at" IS NULL
      AND clinic."status" = 'approved'
      AND clinic."deleted_at" IS NULL;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "clinic_staff_provisioning_identity_idx";
  DROP INDEX "clinics_participation_status_idx";
  DROP INDEX "clinics_provisioning_identity_idx";
  ALTER TABLE "clinic_staff" DROP COLUMN "account_completion_source";
  ALTER TABLE "clinic_staff" DROP COLUMN "account_completion_subject";
  ALTER TABLE "clinic_staff" DROP COLUMN "account_completion_clinic_id";
  ALTER TABLE "clinic_staff" DROP COLUMN "account_completion_evidence_at";
  ALTER TABLE "clinic_staff" DROP COLUMN "account_completion_observed_at";
  ALTER TABLE "clinic_staff" DROP COLUMN "account_completion_auth_action_id";
  ALTER TABLE "clinic_staff" DROP COLUMN "legacy_access_eligible_at";
  ALTER TABLE "clinic_staff" DROP COLUMN "legacy_access_subject";
  ALTER TABLE "clinic_staff" DROP COLUMN "legacy_access_clinic_id";
  ALTER TABLE "clinic_staff" DROP COLUMN "legacy_access_initial_participant";
  ALTER TABLE "clinic_staff" DROP COLUMN "invitation_attempted_at";
  ALTER TABLE "clinic_staff" DROP COLUMN "provisioning_identity";
  ALTER TABLE "clinics" DROP COLUMN "participation_status";
  ALTER TABLE "clinics" DROP COLUMN "provisioning_identity";
  DROP TYPE "public"."enum_clinic_staff_account_completion_source";
  DROP TYPE "public"."enum_clinics_participation_status";`)
}
