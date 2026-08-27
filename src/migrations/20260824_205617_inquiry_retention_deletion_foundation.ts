import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_patient_clinic_inquiries_retention_state" AS ENUM('available', 'anonymized', 'hard-deleted');
  CREATE TYPE "public"."enum_inquiry_retention_policies_status" AS ENUM('active', 'retired');
  CREATE TYPE "public"."enum_inquiry_legal_holds_target_type" AS ENUM('inquiry', 'moderation-case');
  CREATE TYPE "public"."enum_inquiry_legal_holds_reason_category" AS ENUM('legal-request', 'regulatory-review', 'litigation', 'other-authorized');
  CREATE TYPE "public"."enum_inquiry_legal_holds_responsible_function" AS ENUM('legal', 'data-protection');
  CREATE TYPE "public"."enum_inquiry_legal_holds_status" AS ENUM('active', 'released');
  CREATE TYPE "public"."enum_inquiry_deletion_proofs_operation" AS ENUM('anonymized', 'hard-deleted');
  CREATE TYPE "public"."enum_inquiry_deletion_proofs_reason_category" AS ENUM('authorized-erasure', 'retention-review');
  ALTER TYPE "public"."enum_platform_staff_capabilities" ADD VALUE 'inquiry-retention';
  ALTER TYPE "public"."enum_inquiry_audit_events_event_type" ADD VALUE 'legacy-closed-migrated';
  ALTER TYPE "public"."enum_inquiry_audit_events_event_type" ADD VALUE 'inquiry-package-anonymized';
  ALTER TYPE "public"."enum_inquiry_audit_events_event_type" ADD VALUE 'inquiry-package-hard-deleted';
  CREATE TABLE "inquiry_retention_policies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"policy_key" varchar NOT NULL,
  	"version" varchar NOT NULL,
  	"effective_from" timestamp(3) with time zone NOT NULL,
  	"communication_review_months" numeric NOT NULL,
  	"moderation_review_months" numeric NOT NULL,
  	"status" "enum_inquiry_retention_policies_status" DEFAULT 'active' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "inquiry_legal_holds" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"target_type" "enum_inquiry_legal_holds_target_type" NOT NULL,
  	"target_id" varchar NOT NULL,
  	"target_inquiry_id" integer,
  	"target_moderation_case_id" integer,
  	"reason_category" "enum_inquiry_legal_holds_reason_category" NOT NULL,
  	"responsible_function" "enum_inquiry_legal_holds_responsible_function" NOT NULL,
  	"review_at" timestamp(3) with time zone NOT NULL,
  	"placed_by_id" integer NOT NULL,
  	"placed_at" timestamp(3) with time zone NOT NULL,
  	"released_by_id" integer,
  	"released_at" timestamp(3) with time zone,
  	"status" "enum_inquiry_legal_holds_status" DEFAULT 'active' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "inquiry_deletion_proofs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"inquiry_id" varchar NOT NULL,
  	"tombstone_key" varchar NOT NULL,
  	"operation" "enum_inquiry_deletion_proofs_operation" NOT NULL,
  	"reason_category" "enum_inquiry_deletion_proofs_reason_category" NOT NULL,
  	"performed_by_id" integer NOT NULL,
  	"performed_at" timestamp(3) with time zone NOT NULL,
  	"policy_version" varchar NOT NULL,
  	"deleted_object_count" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  INSERT INTO "inquiry_retention_policies" (
    "policy_key",
    "version",
    "effective_from",
    "communication_review_months",
    "moderation_review_months",
    "status"
  )
  SELECT 'inquiry-communication', '2026-08-24', '2026-08-24T00:00:00.000Z', 12, 24, 'active'
  WHERE NOT EXISTS (
    SELECT 1 FROM "inquiry_retention_policies"
    WHERE "policy_key" = 'inquiry-communication' AND "version" = '2026-08-24'
  );
  
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "retention_policy_version" varchar;
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "retention_review_basis_at" timestamp(3) with time zone;
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "retention_review_due_at" timestamp(3) with time zone;
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "retention_state" "enum_patient_clinic_inquiries_retention_state" DEFAULT 'available';
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "deletion_tombstone_key" varchar;
  ALTER TABLE "inquiry_audit_events" ADD COLUMN "affects_activity" boolean DEFAULT true NOT NULL;
  ALTER TABLE "inquiry_moderation_cases" ADD COLUMN "retention_policy_version" varchar;
  ALTER TABLE "inquiry_moderation_cases" ADD COLUMN "retention_review_due_at" timestamp(3) with time zone;
  UPDATE "patient_clinic_inquiries"
  SET
    "retention_policy_version" = COALESCE("retention_policy_version", '2026-08-24'),
    "retention_review_basis_at" = COALESCE(
      "retention_review_basis_at",
      "last_external_activity_at",
      "created_at"
    ),
    "retention_review_due_at" = COALESCE(
      "retention_review_due_at",
      COALESCE("retention_review_basis_at", "last_external_activity_at", "created_at") + INTERVAL '12 months'
    ),
    "retention_state" = COALESCE("retention_state", 'available')
  WHERE
    "retention_policy_version" IS NULL
    OR "retention_review_basis_at" IS NULL
    OR "retention_review_due_at" IS NULL
    OR "retention_state" IS NULL;
  UPDATE "inquiry_moderation_cases"
  SET
    "retention_policy_version" = COALESCE("retention_policy_version", '2026-08-24'),
    "retention_review_due_at" = COALESCE(
      "retention_review_due_at",
      CASE
        WHEN "final_outcome_at" IS NOT NULL AND "measure_ended_at" IS NOT NULL
          THEN GREATEST("final_outcome_at", "measure_ended_at") + INTERVAL '24 months'
        ELSE NULL
      END
    )
  WHERE
    "retention_policy_version" IS NULL
    OR (
      "retention_review_due_at" IS NULL
      AND "final_outcome_at" IS NOT NULL
      AND "measure_ended_at" IS NOT NULL
    );
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "inquiry_retention_policies_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "inquiry_legal_holds_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "inquiry_deletion_proofs_id" integer;
  ALTER TABLE "inquiry_legal_holds" ADD CONSTRAINT "inquiry_legal_holds_target_inquiry_id_patient_clinic_inquiries_id_fk" FOREIGN KEY ("target_inquiry_id") REFERENCES "public"."patient_clinic_inquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_legal_holds" ADD CONSTRAINT "inquiry_legal_holds_target_moderation_case_id_inquiry_moderation_cases_id_fk" FOREIGN KEY ("target_moderation_case_id") REFERENCES "public"."inquiry_moderation_cases"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_legal_holds" ADD CONSTRAINT "inquiry_legal_holds_placed_by_id_platform_staff_id_fk" FOREIGN KEY ("placed_by_id") REFERENCES "public"."platform_staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_legal_holds" ADD CONSTRAINT "inquiry_legal_holds_released_by_id_platform_staff_id_fk" FOREIGN KEY ("released_by_id") REFERENCES "public"."platform_staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_deletion_proofs" ADD CONSTRAINT "inquiry_deletion_proofs_performed_by_id_platform_staff_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."platform_staff"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "inquiry_retention_policies_policy_key_idx" ON "inquiry_retention_policies" USING btree ("policy_key");
  CREATE INDEX "inquiry_retention_policies_version_idx" ON "inquiry_retention_policies" USING btree ("version");
  CREATE INDEX "inquiry_retention_policies_effective_from_idx" ON "inquiry_retention_policies" USING btree ("effective_from");
  CREATE INDEX "inquiry_retention_policies_status_idx" ON "inquiry_retention_policies" USING btree ("status");
  CREATE INDEX "inquiry_retention_policies_updated_at_idx" ON "inquiry_retention_policies" USING btree ("updated_at");
  CREATE INDEX "inquiry_retention_policies_created_at_idx" ON "inquiry_retention_policies" USING btree ("created_at");
  CREATE UNIQUE INDEX "policyKey_version_idx" ON "inquiry_retention_policies" USING btree ("policy_key","version");
  CREATE INDEX "inquiry_legal_holds_target_type_idx" ON "inquiry_legal_holds" USING btree ("target_type");
  CREATE INDEX "inquiry_legal_holds_target_id_idx" ON "inquiry_legal_holds" USING btree ("target_id");
  CREATE INDEX "inquiry_legal_holds_target_inquiry_idx" ON "inquiry_legal_holds" USING btree ("target_inquiry_id");
  CREATE INDEX "inquiry_legal_holds_target_moderation_case_idx" ON "inquiry_legal_holds" USING btree ("target_moderation_case_id");
  CREATE INDEX "inquiry_legal_holds_review_at_idx" ON "inquiry_legal_holds" USING btree ("review_at");
  CREATE INDEX "inquiry_legal_holds_placed_by_idx" ON "inquiry_legal_holds" USING btree ("placed_by_id");
  CREATE INDEX "inquiry_legal_holds_released_by_idx" ON "inquiry_legal_holds" USING btree ("released_by_id");
  CREATE INDEX "inquiry_legal_holds_released_at_idx" ON "inquiry_legal_holds" USING btree ("released_at");
  CREATE INDEX "inquiry_legal_holds_status_idx" ON "inquiry_legal_holds" USING btree ("status");
  CREATE INDEX "inquiry_legal_holds_updated_at_idx" ON "inquiry_legal_holds" USING btree ("updated_at");
  CREATE INDEX "inquiry_legal_holds_created_at_idx" ON "inquiry_legal_holds" USING btree ("created_at");
  CREATE INDEX "targetType_targetId_status_idx" ON "inquiry_legal_holds" USING btree ("target_type","target_id","status");
  CREATE INDEX "inquiry_deletion_proofs_inquiry_id_idx" ON "inquiry_deletion_proofs" USING btree ("inquiry_id");
  CREATE INDEX "inquiry_deletion_proofs_tombstone_key_idx" ON "inquiry_deletion_proofs" USING btree ("tombstone_key");
  CREATE INDEX "inquiry_deletion_proofs_operation_idx" ON "inquiry_deletion_proofs" USING btree ("operation");
  CREATE INDEX "inquiry_deletion_proofs_performed_by_idx" ON "inquiry_deletion_proofs" USING btree ("performed_by_id");
  CREATE INDEX "inquiry_deletion_proofs_performed_at_idx" ON "inquiry_deletion_proofs" USING btree ("performed_at");
  CREATE INDEX "inquiry_deletion_proofs_updated_at_idx" ON "inquiry_deletion_proofs" USING btree ("updated_at");
  CREATE INDEX "inquiry_deletion_proofs_created_at_idx" ON "inquiry_deletion_proofs" USING btree ("created_at");
  CREATE UNIQUE INDEX "tombstoneKey_idx" ON "inquiry_deletion_proofs" USING btree ("tombstone_key");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inquiry_retention_policies_fk" FOREIGN KEY ("inquiry_retention_policies_id") REFERENCES "public"."inquiry_retention_policies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inquiry_legal_holds_fk" FOREIGN KEY ("inquiry_legal_holds_id") REFERENCES "public"."inquiry_legal_holds"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inquiry_deletion_proofs_fk" FOREIGN KEY ("inquiry_deletion_proofs_id") REFERENCES "public"."inquiry_deletion_proofs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "patient_clinic_inquiries_retention_policy_version_idx" ON "patient_clinic_inquiries" USING btree ("retention_policy_version");
  CREATE INDEX "patient_clinic_inquiries_retention_review_basis_at_idx" ON "patient_clinic_inquiries" USING btree ("retention_review_basis_at");
  CREATE INDEX "patient_clinic_inquiries_retention_review_due_at_idx" ON "patient_clinic_inquiries" USING btree ("retention_review_due_at");
  CREATE INDEX "patient_clinic_inquiries_retention_state_idx" ON "patient_clinic_inquiries" USING btree ("retention_state");
  CREATE UNIQUE INDEX "patient_clinic_inquiries_deletion_tombstone_key_idx" ON "patient_clinic_inquiries" USING btree ("deletion_tombstone_key");
  CREATE INDEX "inquiry_moderation_cases_retention_policy_version_idx" ON "inquiry_moderation_cases" USING btree ("retention_policy_version");
  CREATE INDEX "inquiry_moderation_cases_retention_review_due_at_idx" ON "inquiry_moderation_cases" USING btree ("retention_review_due_at");
  CREATE INDEX "payload_locked_documents_rels_inquiry_retention_policies_idx" ON "payload_locked_documents_rels" USING btree ("inquiry_retention_policies_id");
  CREATE INDEX "payload_locked_documents_rels_inquiry_legal_holds_id_idx" ON "payload_locked_documents_rels" USING btree ("inquiry_legal_holds_id");
  CREATE INDEX "payload_locked_documents_rels_inquiry_deletion_proofs_id_idx" ON "payload_locked_documents_rels" USING btree ("inquiry_deletion_proofs_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM "platform_staff_capabilities" WHERE "value" = 'inquiry-retention') THEN
       RAISE EXCEPTION 'Cannot roll back inquiry retention while capability grants still exist.';
     END IF;
     IF EXISTS (
       SELECT 1 FROM "inquiry_audit_events"
       WHERE "event_type"::text IN ('legacy-closed-migrated', 'inquiry-package-anonymized', 'inquiry-package-hard-deleted')
     ) THEN
       RAISE EXCEPTION 'Cannot roll back inquiry retention while retention audit events still exist.';
     END IF;
     IF EXISTS (SELECT 1 FROM "inquiry_legal_holds") THEN
       RAISE EXCEPTION 'Cannot roll back inquiry retention while legal holds still exist.';
     END IF;
     IF EXISTS (SELECT 1 FROM "inquiry_deletion_proofs") THEN
       RAISE EXCEPTION 'Cannot roll back inquiry retention while deletion proofs still exist.';
     END IF;
   END $$;
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_inquiry_retention_policies_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_inquiry_legal_holds_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_inquiry_deletion_proofs_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_inquiry_retention_policies_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_inquiry_legal_holds_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_inquiry_deletion_proofs_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "inquiry_retention_policies_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "inquiry_legal_holds_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "inquiry_deletion_proofs_id";
   ALTER TABLE "inquiry_retention_policies" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "inquiry_legal_holds" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "inquiry_deletion_proofs" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "inquiry_retention_policies" CASCADE;
  DROP TABLE "inquiry_legal_holds" CASCADE;
  DROP TABLE "inquiry_deletion_proofs" CASCADE;
  ALTER TABLE "platform_staff_capabilities" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_platform_staff_capabilities";
  CREATE TYPE "public"."enum_platform_staff_capabilities" AS ENUM('conversation-moderation');
  ALTER TABLE "platform_staff_capabilities" ALTER COLUMN "value" SET DATA TYPE "public"."enum_platform_staff_capabilities" USING "value"::"public"."enum_platform_staff_capabilities";
  ALTER TABLE "inquiry_audit_events" ALTER COLUMN "event_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_inquiry_audit_events_event_type";
  CREATE TYPE "public"."enum_inquiry_audit_events_event_type" AS ENUM('inquiry-created', 'message-sent', 'internal-note-added', 'handling-status-changed', 'closed', 'reopened', 'marked-spam', 'spam-removed', 'attachment-draft-created', 'attachment-finalized', 'attachment-discarded', 'contact-revealed', 'moderation-restricted', 'moderation-restored');
  ALTER TABLE "inquiry_audit_events" ALTER COLUMN "event_type" SET DATA TYPE "public"."enum_inquiry_audit_events_event_type" USING "event_type"::"public"."enum_inquiry_audit_events_event_type";
  DROP INDEX "patient_clinic_inquiries_retention_policy_version_idx";
  DROP INDEX "patient_clinic_inquiries_retention_review_basis_at_idx";
  DROP INDEX "patient_clinic_inquiries_retention_review_due_at_idx";
  DROP INDEX "patient_clinic_inquiries_retention_state_idx";
  DROP INDEX "patient_clinic_inquiries_deletion_tombstone_key_idx";
  DROP INDEX "inquiry_moderation_cases_retention_policy_version_idx";
  DROP INDEX "inquiry_moderation_cases_retention_review_due_at_idx";
  ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "retention_policy_version";
  ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "retention_review_basis_at";
  ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "retention_review_due_at";
  ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "retention_state";
  ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "deletion_tombstone_key";
  ALTER TABLE "inquiry_audit_events" DROP COLUMN "affects_activity";
  ALTER TABLE "inquiry_moderation_cases" DROP COLUMN "retention_policy_version";
  ALTER TABLE "inquiry_moderation_cases" DROP COLUMN "retention_review_due_at";
  DROP TYPE "public"."enum_patient_clinic_inquiries_retention_state";
  DROP TYPE "public"."enum_inquiry_retention_policies_status";
  DROP TYPE "public"."enum_inquiry_legal_holds_target_type";
  DROP TYPE "public"."enum_inquiry_legal_holds_reason_category";
  DROP TYPE "public"."enum_inquiry_legal_holds_responsible_function";
  DROP TYPE "public"."enum_inquiry_legal_holds_status";
  DROP TYPE "public"."enum_inquiry_deletion_proofs_operation";
  DROP TYPE "public"."enum_inquiry_deletion_proofs_reason_category";`)
}
