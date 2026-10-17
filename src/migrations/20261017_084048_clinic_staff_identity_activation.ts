import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_clinic_staff_assignment_scope" AS ENUM('local', 'group', 'unassigned');
  CREATE TYPE "public"."enum_clinic_staff_activation_readiness_version" AS ENUM('identity-v1');
  ALTER TABLE "clinic_staff" ADD COLUMN "assignment_scope" "enum_clinic_staff_assignment_scope";
  ALTER TABLE "clinic_staff" ADD COLUMN "activation_readiness_version" "enum_clinic_staff_activation_readiness_version";
  ALTER TABLE "clinic_staff" ADD COLUMN "activation_readiness_principal_id" varchar;
  ALTER TABLE "clinic_staff" ADD COLUMN "activation_readiness_subject" varchar;
  ALTER TABLE "clinic_staff" ADD COLUMN "activation_readiness_established_at" timestamp(3) with time zone;
`)
  await backfillLocalClinicActivation({ db })
}

export async function backfillLocalClinicActivation({ db }: Pick<MigrateUpArgs, 'db'>): Promise<void> {
  // Freeze historical columns so later runtime collection fields cannot break fresh migration replay.
  // Readiness is derived only while the original immutable subject/clinic proof still validates.
  await db.execute(sql`
    UPDATE "clinic_staff"
    SET "activation_readiness_version" = 'identity-v1',
        "activation_readiness_principal_id" = "id"::text,
        "activation_readiness_subject" = "supabase_user_id",
        "activation_readiness_established_at" = statement_timestamp(),
        "assignment_scope" = 'local'
    WHERE "assignment_scope" IS NULL
      AND "clinic_id" IS NOT NULL
      AND "activation_readiness_version" IS NULL
      AND "activation_readiness_principal_id" IS NULL
      AND "activation_readiness_subject" IS NULL
      AND "activation_readiness_established_at" IS NULL
      AND "supabase_user_id" IS NOT NULL
      AND btrim("supabase_user_id") <> ''
      AND "account_completion_source" IS NOT NULL
      AND "account_completion_subject" = "supabase_user_id"
      AND "account_completion_clinic_id" = "clinic_id"::text
      AND "account_completion_evidence_at" IS NOT NULL
      AND isfinite("account_completion_evidence_at")
      AND "account_completion_observed_at" IS NOT NULL
      AND isfinite("account_completion_observed_at");
    UPDATE "clinic_staff"
    SET "assignment_scope" = 'local'
    WHERE "assignment_scope" IS NULL AND "clinic_id" IS NOT NULL;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinic_staff" DROP COLUMN "assignment_scope";
  ALTER TABLE "clinic_staff" DROP COLUMN "activation_readiness_version";
  ALTER TABLE "clinic_staff" DROP COLUMN "activation_readiness_principal_id";
  ALTER TABLE "clinic_staff" DROP COLUMN "activation_readiness_subject";
  ALTER TABLE "clinic_staff" DROP COLUMN "activation_readiness_established_at";
  DROP TYPE "public"."enum_clinic_staff_assignment_scope";
  DROP TYPE "public"."enum_clinic_staff_activation_readiness_version";`)
}
