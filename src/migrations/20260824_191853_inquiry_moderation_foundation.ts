import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_platform_staff_capabilities" AS ENUM('conversation-moderation');
  CREATE TYPE "public"."enum_inquiry_moderation_cases_target_type" AS ENUM('message', 'attachment', 'conversation');
  CREATE TYPE "public"."enum_inquiry_moderation_cases_reporter_kind" AS ENUM('patient', 'clinic');
  CREATE TYPE "public"."enum_inquiry_moderation_cases_category" AS ENUM('harassment-threats', 'spam-fraud-impersonation', 'suspected-illegal-content', 'privacy-concern', 'other');
  CREATE TYPE "public"."enum_inquiry_moderation_cases_status" AS ENUM('open', 'decided', 'appealed', 'resolved');
  CREATE TYPE "public"."enum_inquiry_moderation_cases_decision_outcome" AS ENUM('no-action', 'content-restricted', 'conversation-restricted', 'identity-messaging-suspended');
  CREATE TYPE "public"."enum_inquiry_moderation_cases_decision_category" AS ENUM('harassment-threats', 'spam-fraud-impersonation', 'suspected-illegal-content', 'privacy-concern', 'other');
  CREATE TYPE "public"."enum_inquiry_moderation_cases_affected_actor_kind" AS ENUM('patient', 'clinic');
  CREATE TYPE "public"."enum_inquiry_moderation_cases_appeal_actor_kind" AS ENUM('patient', 'clinic');
  CREATE TYPE "public"."enum_inquiry_moderation_cases_appeal_outcome" AS ENUM('pending', 'upheld', 'overturned');
  CREATE TYPE "public"."enum_inquiry_moderation_events_actor_kind" AS ENUM('patient', 'clinic', 'platform', 'system');
  CREATE TYPE "public"."enum_inquiry_moderation_events_event_type" AS ENUM('report-received', 'case-accessed', 'access-expanded', 'decision-recorded', 'appeal-submitted', 'appeal-decided', 'measure-ended');
  CREATE TABLE "platform_staff_capabilities" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_platform_staff_capabilities",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "inquiry_moderation_cases" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"inquiry_id" integer NOT NULL,
  	"clinic_id" integer NOT NULL,
  	"patient_id" integer NOT NULL,
  	"conversation_id" integer NOT NULL,
  	"target_type" "enum_inquiry_moderation_cases_target_type" NOT NULL,
  	"target_id" varchar NOT NULL,
  	"target_message_id" integer,
  	"target_attachment_id" integer,
  	"reporter_kind" "enum_inquiry_moderation_cases_reporter_kind" NOT NULL,
  	"reporter_patient_id" integer,
  	"reporter_clinic_staff_id" integer,
  	"reporter_key" varchar NOT NULL,
  	"category" "enum_inquiry_moderation_cases_category" NOT NULL,
  	"description" varchar,
  	"idempotency_key" varchar NOT NULL,
  	"request_hash" varchar NOT NULL,
  	"status" "enum_inquiry_moderation_cases_status" DEFAULT 'open' NOT NULL,
  	"access_expanded_at" timestamp(3) with time zone,
  	"access_expanded_by_id" integer,
  	"access_expansion_reason" varchar,
  	"decision_outcome" "enum_inquiry_moderation_cases_decision_outcome",
  	"decision_category" "enum_inquiry_moderation_cases_decision_category",
  	"decision_reason" varchar,
  	"decision_by_id" integer,
  	"decision_at" timestamp(3) with time zone,
  	"effective_until" timestamp(3) with time zone,
  	"affected_actor_kind" "enum_inquiry_moderation_cases_affected_actor_kind",
  	"affected_patient_id" integer,
  	"affected_clinic_staff_id" integer,
  	"appeal_text" varchar,
  	"appeal_actor_kind" "enum_inquiry_moderation_cases_appeal_actor_kind",
  	"appeal_patient_id" integer,
  	"appeal_clinic_staff_id" integer,
  	"appealed_at" timestamp(3) with time zone,
  	"appeal_outcome" "enum_inquiry_moderation_cases_appeal_outcome",
  	"appeal_decision_reason" varchar,
  	"appeal_decided_by_id" integer,
  	"appeal_decided_at" timestamp(3) with time zone,
  	"final_outcome_at" timestamp(3) with time zone,
  	"event_sequence" numeric DEFAULT 1 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "inquiry_moderation_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"moderation_case_id" integer NOT NULL,
  	"inquiry_id" integer NOT NULL,
  	"clinic_id" integer NOT NULL,
  	"patient_id" integer NOT NULL,
  	"conversation_id" integer NOT NULL,
  	"actor_kind" "enum_inquiry_moderation_events_actor_kind" NOT NULL,
  	"actor_id" varchar NOT NULL,
  	"event_type" "enum_inquiry_moderation_events_event_type" NOT NULL,
  	"reason" varchar,
  	"from_value" varchar,
  	"to_value" varchar,
  	"target_type" varchar,
  	"target_id" varchar,
  	"sequence" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "inquiry_moderation_cases_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "inquiry_moderation_events_id" integer;
  ALTER TABLE "platform_staff_capabilities" ADD CONSTRAINT "platform_staff_capabilities_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."platform_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "inquiry_moderation_cases" ADD CONSTRAINT "inquiry_moderation_cases_inquiry_id_patient_clinic_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."patient_clinic_inquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_moderation_cases" ADD CONSTRAINT "inquiry_moderation_cases_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_moderation_cases" ADD CONSTRAINT "inquiry_moderation_cases_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_moderation_cases" ADD CONSTRAINT "inquiry_moderation_cases_conversation_id_inquiry_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."inquiry_conversations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_moderation_cases" ADD CONSTRAINT "inquiry_moderation_cases_target_message_id_inquiry_messages_id_fk" FOREIGN KEY ("target_message_id") REFERENCES "public"."inquiry_messages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_moderation_cases" ADD CONSTRAINT "inquiry_moderation_cases_target_attachment_id_inquiry_attachments_id_fk" FOREIGN KEY ("target_attachment_id") REFERENCES "public"."inquiry_attachments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_moderation_cases" ADD CONSTRAINT "inquiry_moderation_cases_reporter_patient_id_patients_id_fk" FOREIGN KEY ("reporter_patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_moderation_cases" ADD CONSTRAINT "inquiry_moderation_cases_reporter_clinic_staff_id_clinic_staff_id_fk" FOREIGN KEY ("reporter_clinic_staff_id") REFERENCES "public"."clinic_staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_moderation_cases" ADD CONSTRAINT "inquiry_moderation_cases_access_expanded_by_id_platform_staff_id_fk" FOREIGN KEY ("access_expanded_by_id") REFERENCES "public"."platform_staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_moderation_cases" ADD CONSTRAINT "inquiry_moderation_cases_decision_by_id_platform_staff_id_fk" FOREIGN KEY ("decision_by_id") REFERENCES "public"."platform_staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_moderation_cases" ADD CONSTRAINT "inquiry_moderation_cases_affected_patient_id_patients_id_fk" FOREIGN KEY ("affected_patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_moderation_cases" ADD CONSTRAINT "inquiry_moderation_cases_affected_clinic_staff_id_clinic_staff_id_fk" FOREIGN KEY ("affected_clinic_staff_id") REFERENCES "public"."clinic_staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_moderation_cases" ADD CONSTRAINT "inquiry_moderation_cases_appeal_patient_id_patients_id_fk" FOREIGN KEY ("appeal_patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_moderation_cases" ADD CONSTRAINT "inquiry_moderation_cases_appeal_clinic_staff_id_clinic_staff_id_fk" FOREIGN KEY ("appeal_clinic_staff_id") REFERENCES "public"."clinic_staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_moderation_cases" ADD CONSTRAINT "inquiry_moderation_cases_appeal_decided_by_id_platform_staff_id_fk" FOREIGN KEY ("appeal_decided_by_id") REFERENCES "public"."platform_staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_moderation_events" ADD CONSTRAINT "inquiry_moderation_events_moderation_case_id_inquiry_moderation_cases_id_fk" FOREIGN KEY ("moderation_case_id") REFERENCES "public"."inquiry_moderation_cases"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_moderation_events" ADD CONSTRAINT "inquiry_moderation_events_inquiry_id_patient_clinic_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."patient_clinic_inquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_moderation_events" ADD CONSTRAINT "inquiry_moderation_events_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_moderation_events" ADD CONSTRAINT "inquiry_moderation_events_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_moderation_events" ADD CONSTRAINT "inquiry_moderation_events_conversation_id_inquiry_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."inquiry_conversations"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "platform_staff_capabilities_order_idx" ON "platform_staff_capabilities" USING btree ("order");
  CREATE INDEX "platform_staff_capabilities_parent_idx" ON "platform_staff_capabilities" USING btree ("parent_id");
  CREATE INDEX "inquiry_moderation_cases_inquiry_idx" ON "inquiry_moderation_cases" USING btree ("inquiry_id");
  CREATE INDEX "inquiry_moderation_cases_clinic_idx" ON "inquiry_moderation_cases" USING btree ("clinic_id");
  CREATE INDEX "inquiry_moderation_cases_patient_idx" ON "inquiry_moderation_cases" USING btree ("patient_id");
  CREATE INDEX "inquiry_moderation_cases_conversation_idx" ON "inquiry_moderation_cases" USING btree ("conversation_id");
  CREATE INDEX "inquiry_moderation_cases_target_type_idx" ON "inquiry_moderation_cases" USING btree ("target_type");
  CREATE INDEX "inquiry_moderation_cases_target_id_idx" ON "inquiry_moderation_cases" USING btree ("target_id");
  CREATE INDEX "inquiry_moderation_cases_target_message_idx" ON "inquiry_moderation_cases" USING btree ("target_message_id");
  CREATE INDEX "inquiry_moderation_cases_target_attachment_idx" ON "inquiry_moderation_cases" USING btree ("target_attachment_id");
  CREATE INDEX "inquiry_moderation_cases_reporter_patient_idx" ON "inquiry_moderation_cases" USING btree ("reporter_patient_id");
  CREATE INDEX "inquiry_moderation_cases_reporter_clinic_staff_idx" ON "inquiry_moderation_cases" USING btree ("reporter_clinic_staff_id");
  CREATE INDEX "inquiry_moderation_cases_reporter_key_idx" ON "inquiry_moderation_cases" USING btree ("reporter_key");
  CREATE INDEX "inquiry_moderation_cases_idempotency_key_idx" ON "inquiry_moderation_cases" USING btree ("idempotency_key");
  CREATE INDEX "inquiry_moderation_cases_status_idx" ON "inquiry_moderation_cases" USING btree ("status");
  CREATE INDEX "inquiry_moderation_cases_access_expanded_by_idx" ON "inquiry_moderation_cases" USING btree ("access_expanded_by_id");
  CREATE INDEX "inquiry_moderation_cases_decision_outcome_idx" ON "inquiry_moderation_cases" USING btree ("decision_outcome");
  CREATE INDEX "inquiry_moderation_cases_decision_by_idx" ON "inquiry_moderation_cases" USING btree ("decision_by_id");
  CREATE INDEX "inquiry_moderation_cases_decision_at_idx" ON "inquiry_moderation_cases" USING btree ("decision_at");
  CREATE INDEX "inquiry_moderation_cases_effective_until_idx" ON "inquiry_moderation_cases" USING btree ("effective_until");
  CREATE INDEX "inquiry_moderation_cases_affected_patient_idx" ON "inquiry_moderation_cases" USING btree ("affected_patient_id");
  CREATE INDEX "inquiry_moderation_cases_affected_clinic_staff_idx" ON "inquiry_moderation_cases" USING btree ("affected_clinic_staff_id");
  CREATE INDEX "inquiry_moderation_cases_appeal_patient_idx" ON "inquiry_moderation_cases" USING btree ("appeal_patient_id");
  CREATE INDEX "inquiry_moderation_cases_appeal_clinic_staff_idx" ON "inquiry_moderation_cases" USING btree ("appeal_clinic_staff_id");
  CREATE INDEX "inquiry_moderation_cases_appealed_at_idx" ON "inquiry_moderation_cases" USING btree ("appealed_at");
  CREATE INDEX "inquiry_moderation_cases_appeal_decided_by_idx" ON "inquiry_moderation_cases" USING btree ("appeal_decided_by_id");
  CREATE INDEX "inquiry_moderation_cases_appeal_decided_at_idx" ON "inquiry_moderation_cases" USING btree ("appeal_decided_at");
  CREATE INDEX "inquiry_moderation_cases_final_outcome_at_idx" ON "inquiry_moderation_cases" USING btree ("final_outcome_at");
  CREATE INDEX "inquiry_moderation_cases_updated_at_idx" ON "inquiry_moderation_cases" USING btree ("updated_at");
  CREATE INDEX "inquiry_moderation_cases_created_at_idx" ON "inquiry_moderation_cases" USING btree ("created_at");
  CREATE INDEX "inquiry_moderation_cases_deleted_at_idx" ON "inquiry_moderation_cases" USING btree ("deleted_at");
  CREATE UNIQUE INDEX "reporterKey_idempotencyKey_idx" ON "inquiry_moderation_cases" USING btree ("reporter_key","idempotency_key");
  CREATE INDEX "inquiry_moderation_events_moderation_case_idx" ON "inquiry_moderation_events" USING btree ("moderation_case_id");
  CREATE INDEX "inquiry_moderation_events_inquiry_idx" ON "inquiry_moderation_events" USING btree ("inquiry_id");
  CREATE INDEX "inquiry_moderation_events_clinic_idx" ON "inquiry_moderation_events" USING btree ("clinic_id");
  CREATE INDEX "inquiry_moderation_events_patient_idx" ON "inquiry_moderation_events" USING btree ("patient_id");
  CREATE INDEX "inquiry_moderation_events_conversation_idx" ON "inquiry_moderation_events" USING btree ("conversation_id");
  CREATE INDEX "inquiry_moderation_events_actor_id_idx" ON "inquiry_moderation_events" USING btree ("actor_id");
  CREATE INDEX "inquiry_moderation_events_event_type_idx" ON "inquiry_moderation_events" USING btree ("event_type");
  CREATE INDEX "inquiry_moderation_events_sequence_idx" ON "inquiry_moderation_events" USING btree ("sequence");
  CREATE INDEX "inquiry_moderation_events_updated_at_idx" ON "inquiry_moderation_events" USING btree ("updated_at");
  CREATE INDEX "inquiry_moderation_events_created_at_idx" ON "inquiry_moderation_events" USING btree ("created_at");
  CREATE UNIQUE INDEX "moderationCase_sequence_idx" ON "inquiry_moderation_events" USING btree ("moderation_case_id","sequence");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inquiry_moderation_cases_fk" FOREIGN KEY ("inquiry_moderation_cases_id") REFERENCES "public"."inquiry_moderation_cases"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inquiry_moderation_events_fk" FOREIGN KEY ("inquiry_moderation_events_id") REFERENCES "public"."inquiry_moderation_events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_inquiry_moderation_cases_i_idx" ON "payload_locked_documents_rels" USING btree ("inquiry_moderation_cases_id");
  CREATE INDEX "payload_locked_documents_rels_inquiry_moderation_events__idx" ON "payload_locked_documents_rels" USING btree ("inquiry_moderation_events_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_inquiry_moderation_cases_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_inquiry_moderation_events_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_inquiry_moderation_cases_i_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_inquiry_moderation_events__idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "inquiry_moderation_cases_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "inquiry_moderation_events_id";
  DROP TABLE IF EXISTS "platform_staff_capabilities" CASCADE;
  DROP TABLE IF EXISTS "inquiry_moderation_events" CASCADE;
  DROP TABLE IF EXISTS "inquiry_moderation_cases" CASCADE;
  DROP TYPE IF EXISTS "public"."enum_platform_staff_capabilities";
  DROP TYPE IF EXISTS "public"."enum_inquiry_moderation_cases_target_type";
  DROP TYPE IF EXISTS "public"."enum_inquiry_moderation_cases_reporter_kind";
  DROP TYPE IF EXISTS "public"."enum_inquiry_moderation_cases_category";
  DROP TYPE IF EXISTS "public"."enum_inquiry_moderation_cases_status";
  DROP TYPE IF EXISTS "public"."enum_inquiry_moderation_cases_decision_outcome";
  DROP TYPE IF EXISTS "public"."enum_inquiry_moderation_cases_decision_category";
  DROP TYPE IF EXISTS "public"."enum_inquiry_moderation_cases_affected_actor_kind";
  DROP TYPE IF EXISTS "public"."enum_inquiry_moderation_cases_appeal_actor_kind";
  DROP TYPE IF EXISTS "public"."enum_inquiry_moderation_cases_appeal_outcome";
  DROP TYPE IF EXISTS "public"."enum_inquiry_moderation_events_actor_kind";
  DROP TYPE IF EXISTS "public"."enum_inquiry_moderation_events_event_type";`)
}
