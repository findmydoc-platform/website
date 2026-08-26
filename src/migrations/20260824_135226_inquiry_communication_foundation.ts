import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_patient_clinic_inquiries_handling_status" AS ENUM('submitted', 'in_review', 'contacted', 'spam');
  CREATE TYPE "public"."enum_patient_clinic_inquiries_lifecycle" AS ENUM('open', 'closed');
  CREATE TYPE "public"."enum_patient_clinic_inquiries_previous_handling_status" AS ENUM('submitted', 'in_review', 'contacted');
  CREATE TYPE "public"."enum_inquiry_messages_author_kind" AS ENUM('patient', 'clinic');
  CREATE TYPE "public"."enum_inquiry_attachments_owner_kind" AS ENUM('patient', 'clinic');
  CREATE TYPE "public"."enum_inquiry_attachments_declared_mime_type" AS ENUM('image/png', 'image/jpeg', 'image/webp', 'application/pdf');
  CREATE TYPE "public"."enum_inquiry_attachments_verified_mime_type" AS ENUM('image/png', 'image/jpeg', 'image/webp', 'application/pdf');
  CREATE TYPE "public"."enum_inquiry_attachments_state" AS ENUM('draft', 'verified', 'bound', 'discarded');
  CREATE TYPE "public"."enum_inquiry_read_positions_reader_kind" AS ENUM('patient', 'clinic');
  CREATE TYPE "public"."enum_inquiry_audit_events_actor_kind" AS ENUM('patient', 'clinic', 'system', 'platform');
  CREATE TYPE "public"."enum_inquiry_audit_events_event_type" AS ENUM('inquiry-created', 'message-sent', 'internal-note-added', 'handling-status-changed', 'closed', 'reopened', 'marked-spam', 'spam-removed', 'attachment-draft-created', 'attachment-finalized', 'attachment-discarded', 'contact-revealed');
  CREATE TABLE "inquiry_conversations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"inquiry_id" integer NOT NULL,
  	"clinic_id" integer NOT NULL,
  	"patient_id" integer NOT NULL,
  	"actor_key" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "inquiry_messages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"conversation_id" integer NOT NULL,
  	"inquiry_id" integer NOT NULL,
  	"clinic_id" integer NOT NULL,
  	"patient_id" integer NOT NULL,
  	"author_kind" "enum_inquiry_messages_author_kind" NOT NULL,
  	"author_patient_id" integer,
  	"author_clinic_staff_id" integer,
  	"text" varchar,
  	"attachment_id" integer,
  	"sequence" numeric NOT NULL,
  	"external_sequence" numeric NOT NULL,
  	"clinic_notification_sequence" numeric NOT NULL,
  	"actor_key" varchar NOT NULL,
  	"idempotency_key" varchar NOT NULL,
  	"request_hash" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "inquiry_internal_notes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"inquiry_id" integer NOT NULL,
  	"clinic_id" integer NOT NULL,
  	"author_clinic_staff_id" integer NOT NULL,
  	"text" varchar NOT NULL,
  	"sequence" numeric NOT NULL,
  	"clinic_notification_sequence" numeric NOT NULL,
  	"actor_key" varchar NOT NULL,
  	"idempotency_key" varchar NOT NULL,
  	"request_hash" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "inquiry_attachments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"inquiry_id" integer NOT NULL,
  	"clinic_id" integer NOT NULL,
  	"patient_id" integer NOT NULL,
  	"owner_kind" "enum_inquiry_attachments_owner_kind" NOT NULL,
  	"owner_patient_id" integer,
  	"owner_clinic_staff_id" integer,
  	"file_name" varchar NOT NULL,
  	"declared_mime_type" "enum_inquiry_attachments_declared_mime_type" NOT NULL,
  	"declared_size_bytes" numeric NOT NULL,
  	"verified_mime_type" "enum_inquiry_attachments_verified_mime_type",
  	"verified_size_bytes" numeric,
  	"state" "enum_inquiry_attachments_state" DEFAULT 'draft' NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"object_created_at" timestamp(3) with time zone NOT NULL,
  	"draft_cleanup_completed_at" timestamp(3) with time zone,
  	"cleanup_completed_at" timestamp(3) with time zone,
  	"bound_message_id" integer,
  	"actor_key" varchar NOT NULL,
  	"draft_object_key" varchar NOT NULL,
  	"ready_object_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "inquiry_read_positions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"inquiry_id" integer NOT NULL,
  	"clinic_id" integer NOT NULL,
  	"reader_kind" "enum_inquiry_read_positions_reader_kind" NOT NULL,
  	"reader_patient_id" integer,
  	"reader_clinic_staff_id" integer,
  	"last_read_sequence" numeric DEFAULT 0 NOT NULL,
  	"last_read_activity_id" varchar,
  	"forced_unread" boolean DEFAULT false NOT NULL,
  	"forced_unread_epoch" numeric DEFAULT 0 NOT NULL,
  	"reader_key" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "inquiry_audit_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"inquiry_id" integer NOT NULL,
  	"clinic_id" integer NOT NULL,
  	"actor_kind" "enum_inquiry_audit_events_actor_kind" NOT NULL,
  	"actor_id" varchar NOT NULL,
  	"event_type" "enum_inquiry_audit_events_event_type" NOT NULL,
  	"target_type" varchar,
  	"target_id" varchar,
  	"from_value" varchar,
  	"to_value" varchar,
  	"reason" varchar,
  	"sequence" numeric NOT NULL,
  	"clinic_notification_sequence" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "patient_id" integer;
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "handling_status" "enum_patient_clinic_inquiries_handling_status";
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "lifecycle" "enum_patient_clinic_inquiries_lifecycle";
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "previous_handling_status" "enum_patient_clinic_inquiries_previous_handling_status";
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "revision" numeric;
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "activity_sequence" numeric;
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "external_sequence" numeric;
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "clinic_notification_sequence" numeric;
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "clinic_unread_floor" numeric;
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "clinic_unread_epoch" numeric;
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "last_activity_at" timestamp(3) with time zone;
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "last_external_activity_at" timestamp(3) with time zone;
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "creation_actor_key" varchar;
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "creation_idempotency_key" varchar;
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "creation_request_hash" varchar;
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "inquiry_conversations_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "inquiry_messages_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "inquiry_internal_notes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "inquiry_attachments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "inquiry_read_positions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "inquiry_audit_events_id" integer;
  ALTER TABLE "inquiry_conversations" ADD CONSTRAINT "inquiry_conversations_inquiry_id_patient_clinic_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."patient_clinic_inquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_conversations" ADD CONSTRAINT "inquiry_conversations_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_conversations" ADD CONSTRAINT "inquiry_conversations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_messages" ADD CONSTRAINT "inquiry_messages_conversation_id_inquiry_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."inquiry_conversations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_messages" ADD CONSTRAINT "inquiry_messages_inquiry_id_patient_clinic_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."patient_clinic_inquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_messages" ADD CONSTRAINT "inquiry_messages_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_messages" ADD CONSTRAINT "inquiry_messages_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_messages" ADD CONSTRAINT "inquiry_messages_author_patient_id_patients_id_fk" FOREIGN KEY ("author_patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_messages" ADD CONSTRAINT "inquiry_messages_author_clinic_staff_id_clinic_staff_id_fk" FOREIGN KEY ("author_clinic_staff_id") REFERENCES "public"."clinic_staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_messages" ADD CONSTRAINT "inquiry_messages_attachment_id_inquiry_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."inquiry_attachments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_internal_notes" ADD CONSTRAINT "inquiry_internal_notes_inquiry_id_patient_clinic_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."patient_clinic_inquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_internal_notes" ADD CONSTRAINT "inquiry_internal_notes_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_internal_notes" ADD CONSTRAINT "inquiry_internal_notes_author_clinic_staff_id_clinic_staff_id_fk" FOREIGN KEY ("author_clinic_staff_id") REFERENCES "public"."clinic_staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_attachments" ADD CONSTRAINT "inquiry_attachments_inquiry_id_patient_clinic_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."patient_clinic_inquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_attachments" ADD CONSTRAINT "inquiry_attachments_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_attachments" ADD CONSTRAINT "inquiry_attachments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_attachments" ADD CONSTRAINT "inquiry_attachments_owner_patient_id_patients_id_fk" FOREIGN KEY ("owner_patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_attachments" ADD CONSTRAINT "inquiry_attachments_owner_clinic_staff_id_clinic_staff_id_fk" FOREIGN KEY ("owner_clinic_staff_id") REFERENCES "public"."clinic_staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_attachments" ADD CONSTRAINT "inquiry_attachments_bound_message_id_inquiry_messages_id_fk" FOREIGN KEY ("bound_message_id") REFERENCES "public"."inquiry_messages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_read_positions" ADD CONSTRAINT "inquiry_read_positions_inquiry_id_patient_clinic_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."patient_clinic_inquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_read_positions" ADD CONSTRAINT "inquiry_read_positions_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_read_positions" ADD CONSTRAINT "inquiry_read_positions_reader_patient_id_patients_id_fk" FOREIGN KEY ("reader_patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_read_positions" ADD CONSTRAINT "inquiry_read_positions_reader_clinic_staff_id_clinic_staff_id_fk" FOREIGN KEY ("reader_clinic_staff_id") REFERENCES "public"."clinic_staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_audit_events" ADD CONSTRAINT "inquiry_audit_events_inquiry_id_patient_clinic_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."patient_clinic_inquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_audit_events" ADD CONSTRAINT "inquiry_audit_events_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "inquiry_conversations_inquiry_idx" ON "inquiry_conversations" USING btree ("inquiry_id");
  CREATE INDEX "inquiry_conversations_clinic_idx" ON "inquiry_conversations" USING btree ("clinic_id");
  CREATE INDEX "inquiry_conversations_patient_idx" ON "inquiry_conversations" USING btree ("patient_id");
  CREATE INDEX "inquiry_conversations_actor_key_idx" ON "inquiry_conversations" USING btree ("actor_key");
  CREATE INDEX "inquiry_conversations_updated_at_idx" ON "inquiry_conversations" USING btree ("updated_at");
  CREATE INDEX "inquiry_conversations_created_at_idx" ON "inquiry_conversations" USING btree ("created_at");
  CREATE INDEX "inquiry_conversations_deleted_at_idx" ON "inquiry_conversations" USING btree ("deleted_at");
  CREATE INDEX "inquiry_messages_conversation_idx" ON "inquiry_messages" USING btree ("conversation_id");
  CREATE INDEX "inquiry_messages_inquiry_idx" ON "inquiry_messages" USING btree ("inquiry_id");
  CREATE INDEX "inquiry_messages_clinic_idx" ON "inquiry_messages" USING btree ("clinic_id");
  CREATE INDEX "inquiry_messages_patient_idx" ON "inquiry_messages" USING btree ("patient_id");
  CREATE INDEX "inquiry_messages_author_kind_idx" ON "inquiry_messages" USING btree ("author_kind");
  CREATE INDEX "inquiry_messages_author_patient_idx" ON "inquiry_messages" USING btree ("author_patient_id");
  CREATE INDEX "inquiry_messages_author_clinic_staff_idx" ON "inquiry_messages" USING btree ("author_clinic_staff_id");
  CREATE UNIQUE INDEX "inquiry_messages_attachment_idx" ON "inquiry_messages" USING btree ("attachment_id");
  CREATE INDEX "inquiry_messages_sequence_idx" ON "inquiry_messages" USING btree ("sequence");
  CREATE INDEX "inquiry_messages_external_sequence_idx" ON "inquiry_messages" USING btree ("external_sequence");
  CREATE INDEX "inquiry_messages_clinic_notification_sequence_idx" ON "inquiry_messages" USING btree ("clinic_notification_sequence");
  CREATE INDEX "inquiry_messages_actor_key_idx" ON "inquiry_messages" USING btree ("actor_key");
  CREATE INDEX "inquiry_messages_idempotency_key_idx" ON "inquiry_messages" USING btree ("idempotency_key");
  CREATE INDEX "inquiry_messages_updated_at_idx" ON "inquiry_messages" USING btree ("updated_at");
  CREATE INDEX "inquiry_messages_created_at_idx" ON "inquiry_messages" USING btree ("created_at");
  CREATE INDEX "inquiry_messages_deleted_at_idx" ON "inquiry_messages" USING btree ("deleted_at");
  CREATE UNIQUE INDEX "inquiry_actorKey_idempotencyKey_idx" ON "inquiry_messages" USING btree ("inquiry_id","actor_key","idempotency_key");
  CREATE INDEX "inquiry_internal_notes_inquiry_idx" ON "inquiry_internal_notes" USING btree ("inquiry_id");
  CREATE INDEX "inquiry_internal_notes_clinic_idx" ON "inquiry_internal_notes" USING btree ("clinic_id");
  CREATE INDEX "inquiry_internal_notes_author_clinic_staff_idx" ON "inquiry_internal_notes" USING btree ("author_clinic_staff_id");
  CREATE INDEX "inquiry_internal_notes_sequence_idx" ON "inquiry_internal_notes" USING btree ("sequence");
  CREATE INDEX "inquiry_internal_notes_clinic_notification_sequence_idx" ON "inquiry_internal_notes" USING btree ("clinic_notification_sequence");
  CREATE INDEX "inquiry_internal_notes_actor_key_idx" ON "inquiry_internal_notes" USING btree ("actor_key");
  CREATE INDEX "inquiry_internal_notes_idempotency_key_idx" ON "inquiry_internal_notes" USING btree ("idempotency_key");
  CREATE INDEX "inquiry_internal_notes_updated_at_idx" ON "inquiry_internal_notes" USING btree ("updated_at");
  CREATE INDEX "inquiry_internal_notes_created_at_idx" ON "inquiry_internal_notes" USING btree ("created_at");
  CREATE INDEX "inquiry_internal_notes_deleted_at_idx" ON "inquiry_internal_notes" USING btree ("deleted_at");
  CREATE UNIQUE INDEX "inquiry_actorKey_idempotencyKey_1_idx" ON "inquiry_internal_notes" USING btree ("inquiry_id","actor_key","idempotency_key");
  CREATE INDEX "inquiry_attachments_inquiry_idx" ON "inquiry_attachments" USING btree ("inquiry_id");
  CREATE INDEX "inquiry_attachments_clinic_idx" ON "inquiry_attachments" USING btree ("clinic_id");
  CREATE INDEX "inquiry_attachments_patient_idx" ON "inquiry_attachments" USING btree ("patient_id");
  CREATE INDEX "inquiry_attachments_owner_patient_idx" ON "inquiry_attachments" USING btree ("owner_patient_id");
  CREATE INDEX "inquiry_attachments_owner_clinic_staff_idx" ON "inquiry_attachments" USING btree ("owner_clinic_staff_id");
  CREATE INDEX "inquiry_attachments_state_idx" ON "inquiry_attachments" USING btree ("state");
  CREATE INDEX "inquiry_attachments_expires_at_idx" ON "inquiry_attachments" USING btree ("expires_at");
  CREATE INDEX "inquiry_attachments_object_created_at_idx" ON "inquiry_attachments" USING btree ("object_created_at");
  CREATE INDEX "inquiry_attachments_draft_cleanup_completed_at_idx" ON "inquiry_attachments" USING btree ("draft_cleanup_completed_at");
  CREATE INDEX "inquiry_attachments_cleanup_completed_at_idx" ON "inquiry_attachments" USING btree ("cleanup_completed_at");
  CREATE UNIQUE INDEX "inquiry_attachments_bound_message_idx" ON "inquiry_attachments" USING btree ("bound_message_id");
  CREATE INDEX "inquiry_attachments_actor_key_idx" ON "inquiry_attachments" USING btree ("actor_key");
  CREATE INDEX "inquiry_attachments_draft_object_key_idx" ON "inquiry_attachments" USING btree ("draft_object_key");
  CREATE INDEX "inquiry_attachments_ready_object_key_idx" ON "inquiry_attachments" USING btree ("ready_object_key");
  CREATE INDEX "inquiry_attachments_updated_at_idx" ON "inquiry_attachments" USING btree ("updated_at");
  CREATE INDEX "inquiry_attachments_created_at_idx" ON "inquiry_attachments" USING btree ("created_at");
  CREATE INDEX "inquiry_read_positions_inquiry_idx" ON "inquiry_read_positions" USING btree ("inquiry_id");
  CREATE INDEX "inquiry_read_positions_clinic_idx" ON "inquiry_read_positions" USING btree ("clinic_id");
  CREATE INDEX "inquiry_read_positions_reader_patient_idx" ON "inquiry_read_positions" USING btree ("reader_patient_id");
  CREATE INDEX "inquiry_read_positions_reader_clinic_staff_idx" ON "inquiry_read_positions" USING btree ("reader_clinic_staff_id");
  CREATE INDEX "inquiry_read_positions_reader_key_idx" ON "inquiry_read_positions" USING btree ("reader_key");
  CREATE INDEX "inquiry_read_positions_updated_at_idx" ON "inquiry_read_positions" USING btree ("updated_at");
  CREATE INDEX "inquiry_read_positions_created_at_idx" ON "inquiry_read_positions" USING btree ("created_at");
  CREATE UNIQUE INDEX "inquiry_readerKey_idx" ON "inquiry_read_positions" USING btree ("inquiry_id","reader_key");
  CREATE INDEX "inquiry_audit_events_inquiry_idx" ON "inquiry_audit_events" USING btree ("inquiry_id");
  CREATE INDEX "inquiry_audit_events_clinic_idx" ON "inquiry_audit_events" USING btree ("clinic_id");
  CREATE INDEX "inquiry_audit_events_actor_id_idx" ON "inquiry_audit_events" USING btree ("actor_id");
  CREATE INDEX "inquiry_audit_events_event_type_idx" ON "inquiry_audit_events" USING btree ("event_type");
  CREATE INDEX "inquiry_audit_events_sequence_idx" ON "inquiry_audit_events" USING btree ("sequence");
  CREATE INDEX "inquiry_audit_events_clinic_notification_sequence_idx" ON "inquiry_audit_events" USING btree ("clinic_notification_sequence");
  CREATE INDEX "inquiry_audit_events_updated_at_idx" ON "inquiry_audit_events" USING btree ("updated_at");
  CREATE INDEX "inquiry_audit_events_created_at_idx" ON "inquiry_audit_events" USING btree ("created_at");
  ALTER TABLE "patient_clinic_inquiries" ADD CONSTRAINT "patient_clinic_inquiries_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inquiry_conversations_fk" FOREIGN KEY ("inquiry_conversations_id") REFERENCES "public"."inquiry_conversations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inquiry_messages_fk" FOREIGN KEY ("inquiry_messages_id") REFERENCES "public"."inquiry_messages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inquiry_internal_notes_fk" FOREIGN KEY ("inquiry_internal_notes_id") REFERENCES "public"."inquiry_internal_notes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inquiry_attachments_fk" FOREIGN KEY ("inquiry_attachments_id") REFERENCES "public"."inquiry_attachments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inquiry_read_positions_fk" FOREIGN KEY ("inquiry_read_positions_id") REFERENCES "public"."inquiry_read_positions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inquiry_audit_events_fk" FOREIGN KEY ("inquiry_audit_events_id") REFERENCES "public"."inquiry_audit_events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "patient_clinic_inquiries_patient_idx" ON "patient_clinic_inquiries" USING btree ("patient_id");
  CREATE INDEX "patient_clinic_inquiries_handling_status_idx" ON "patient_clinic_inquiries" USING btree ("handling_status");
  CREATE INDEX "patient_clinic_inquiries_lifecycle_idx" ON "patient_clinic_inquiries" USING btree ("lifecycle");
  CREATE INDEX "patient_clinic_inquiries_revision_idx" ON "patient_clinic_inquiries" USING btree ("revision");
  CREATE INDEX "patient_clinic_inquiries_last_activity_at_idx" ON "patient_clinic_inquiries" USING btree ("last_activity_at");
  CREATE INDEX "patient_clinic_inquiries_last_external_activity_at_idx" ON "patient_clinic_inquiries" USING btree ("last_external_activity_at");
  CREATE INDEX "patient_clinic_inquiries_creation_actor_key_idx" ON "patient_clinic_inquiries" USING btree ("creation_actor_key");
  CREATE INDEX "patient_clinic_inquiries_creation_idempotency_key_idx" ON "patient_clinic_inquiries" USING btree ("creation_idempotency_key");
  CREATE INDEX "patient_clinic_inquiries_deleted_at_idx" ON "patient_clinic_inquiries" USING btree ("deleted_at");
  CREATE UNIQUE INDEX "patient_creationIdempotencyKey_idx" ON "patient_clinic_inquiries" USING btree ("patient_id","creation_idempotency_key");
  CREATE INDEX "payload_locked_documents_rels_inquiry_conversations_id_idx" ON "payload_locked_documents_rels" USING btree ("inquiry_conversations_id");
  CREATE INDEX "payload_locked_documents_rels_inquiry_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("inquiry_messages_id");
  CREATE INDEX "payload_locked_documents_rels_inquiry_internal_notes_id_idx" ON "payload_locked_documents_rels" USING btree ("inquiry_internal_notes_id");
  CREATE INDEX "payload_locked_documents_rels_inquiry_attachments_id_idx" ON "payload_locked_documents_rels" USING btree ("inquiry_attachments_id");
  CREATE INDEX "payload_locked_documents_rels_inquiry_read_positions_id_idx" ON "payload_locked_documents_rels" USING btree ("inquiry_read_positions_id");
  CREATE INDEX "payload_locked_documents_rels_inquiry_audit_events_id_idx" ON "payload_locked_documents_rels" USING btree ("inquiry_audit_events_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "inquiry_conversations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "inquiry_messages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "inquiry_internal_notes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "inquiry_attachments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "inquiry_read_positions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "inquiry_audit_events" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "inquiry_conversations" CASCADE;
  DROP TABLE "inquiry_messages" CASCADE;
  DROP TABLE "inquiry_internal_notes" CASCADE;
  DROP TABLE "inquiry_attachments" CASCADE;
  DROP TABLE "inquiry_read_positions" CASCADE;
  DROP TABLE "inquiry_audit_events" CASCADE;
  ALTER TABLE "patient_clinic_inquiries" DROP CONSTRAINT "patient_clinic_inquiries_patient_id_patients_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_inquiry_conversations_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_inquiry_messages_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_inquiry_internal_notes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_inquiry_attachments_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_inquiry_read_positions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_inquiry_audit_events_fk";
  
  DROP INDEX "patient_clinic_inquiries_patient_idx";
  DROP INDEX "patient_clinic_inquiries_handling_status_idx";
  DROP INDEX "patient_clinic_inquiries_lifecycle_idx";
  DROP INDEX "patient_clinic_inquiries_revision_idx";
  DROP INDEX "patient_clinic_inquiries_last_activity_at_idx";
  DROP INDEX "patient_clinic_inquiries_last_external_activity_at_idx";
  DROP INDEX "patient_clinic_inquiries_creation_actor_key_idx";
  DROP INDEX "patient_clinic_inquiries_creation_idempotency_key_idx";
  DROP INDEX "patient_clinic_inquiries_deleted_at_idx";
  DROP INDEX "patient_creationIdempotencyKey_idx";
  DROP INDEX "payload_locked_documents_rels_inquiry_conversations_id_idx";
  DROP INDEX "payload_locked_documents_rels_inquiry_messages_id_idx";
  DROP INDEX "payload_locked_documents_rels_inquiry_internal_notes_id_idx";
  DROP INDEX "payload_locked_documents_rels_inquiry_attachments_id_idx";
  DROP INDEX "payload_locked_documents_rels_inquiry_read_positions_id_idx";
  DROP INDEX "payload_locked_documents_rels_inquiry_audit_events_id_idx";
  ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "patient_id";
  ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "handling_status";
  ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "lifecycle";
  ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "previous_handling_status";
  ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "revision";
  ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "activity_sequence";
  ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "external_sequence";
  ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "clinic_notification_sequence";
  ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "clinic_unread_floor";
  ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "clinic_unread_epoch";
  ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "last_activity_at";
  ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "last_external_activity_at";
  ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "creation_actor_key";
  ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "creation_idempotency_key";
  ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "creation_request_hash";
  ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "deleted_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "inquiry_conversations_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "inquiry_messages_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "inquiry_internal_notes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "inquiry_attachments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "inquiry_read_positions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "inquiry_audit_events_id";
  DROP TYPE "public"."enum_patient_clinic_inquiries_handling_status";
  DROP TYPE "public"."enum_patient_clinic_inquiries_lifecycle";
  DROP TYPE "public"."enum_patient_clinic_inquiries_previous_handling_status";
  DROP TYPE "public"."enum_inquiry_messages_author_kind";
  DROP TYPE "public"."enum_inquiry_attachments_owner_kind";
  DROP TYPE "public"."enum_inquiry_attachments_declared_mime_type";
  DROP TYPE "public"."enum_inquiry_attachments_verified_mime_type";
  DROP TYPE "public"."enum_inquiry_attachments_state";
  DROP TYPE "public"."enum_inquiry_read_positions_reader_kind";
  DROP TYPE "public"."enum_inquiry_audit_events_actor_kind";
  DROP TYPE "public"."enum_inquiry_audit_events_event_type";`)
}
