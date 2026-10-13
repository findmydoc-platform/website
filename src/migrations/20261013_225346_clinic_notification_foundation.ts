import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_clinic_notification_occurrences_source_record_kind" AS ENUM('inquiry', 'review');
  CREATE TYPE "public"."enum_clinic_notification_occurrences_outcome" AS ENUM('approved', 'rejected', 'blocked', 'upheld', 'confirmed', 'lifted');
  CREATE TABLE "clinic_notification_occurrences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"notification_id" varchar NOT NULL,
  	"clinic_id" integer NOT NULL,
  	"schema_version" numeric DEFAULT 1 NOT NULL,
  	"event_type" varchar NOT NULL,
  	"source_record_kind" "enum_clinic_notification_occurrences_source_record_kind" NOT NULL,
  	"source_record_id" varchar NOT NULL,
  	"source_occurrence_kind" varchar NOT NULL,
  	"source_occurrence_id" varchar NOT NULL,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"outcome" "enum_clinic_notification_occurrences_outcome",
  	"rating" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "clinic_notification_read_receipts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"occurrence_id" integer NOT NULL,
  	"clinic_staff_id" integer NOT NULL,
  	"read_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "clinic_notification_controls" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"active" boolean DEFAULT false NOT NULL,
  	"activated_at" timestamp(3) with time zone,
  	"nonce" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "clinic_notification_occurrences_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "clinic_notification_read_receipts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "clinic_notification_controls_id" integer;
  ALTER TABLE "clinic_notification_occurrences" ADD CONSTRAINT "clinic_notification_occurrences_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "clinic_notification_read_receipts" ADD CONSTRAINT "clinic_notification_read_receipts_occurrence_id_clinic_notification_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."clinic_notification_occurrences"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "clinic_notification_read_receipts" ADD CONSTRAINT "clinic_notification_read_receipts_clinic_staff_id_clinic_staff_id_fk" FOREIGN KEY ("clinic_staff_id") REFERENCES "public"."clinic_staff"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "clinic_notification_occurrences_notification_id_idx" ON "clinic_notification_occurrences" USING btree ("notification_id");
  CREATE INDEX "clinic_notification_occurrences_clinic_idx" ON "clinic_notification_occurrences" USING btree ("clinic_id");
  CREATE INDEX "clinic_notification_occurrences_event_type_idx" ON "clinic_notification_occurrences" USING btree ("event_type");
  CREATE INDEX "clinic_notification_occurrences_source_record_id_idx" ON "clinic_notification_occurrences" USING btree ("source_record_id");
  CREATE INDEX "clinic_notification_occurrences_occurred_at_idx" ON "clinic_notification_occurrences" USING btree ("occurred_at");
  CREATE INDEX "clinic_notification_occurrences_expires_at_idx" ON "clinic_notification_occurrences" USING btree ("expires_at");
  CREATE INDEX "clinic_notification_occurrences_updated_at_idx" ON "clinic_notification_occurrences" USING btree ("updated_at");
  CREATE INDEX "clinic_notification_occurrences_created_at_idx" ON "clinic_notification_occurrences" USING btree ("created_at");
  CREATE UNIQUE INDEX "clinic_eventType_sourceOccurrenceKind_sourceOccurrenceId_idx" ON "clinic_notification_occurrences" USING btree ("clinic_id","event_type","source_occurrence_kind","source_occurrence_id");
  CREATE INDEX "clinic_notification_read_receipts_occurrence_idx" ON "clinic_notification_read_receipts" USING btree ("occurrence_id");
  CREATE INDEX "clinic_notification_read_receipts_clinic_staff_idx" ON "clinic_notification_read_receipts" USING btree ("clinic_staff_id");
  CREATE INDEX "clinic_notification_read_receipts_updated_at_idx" ON "clinic_notification_read_receipts" USING btree ("updated_at");
  CREATE INDEX "clinic_notification_read_receipts_created_at_idx" ON "clinic_notification_read_receipts" USING btree ("created_at");
  CREATE UNIQUE INDEX "occurrence_clinicStaff_idx" ON "clinic_notification_read_receipts" USING btree ("occurrence_id","clinic_staff_id");
  CREATE UNIQUE INDEX "clinic_notification_controls_key_idx" ON "clinic_notification_controls" USING btree ("key");
  CREATE INDEX "clinic_notification_controls_updated_at_idx" ON "clinic_notification_controls" USING btree ("updated_at");
  CREATE INDEX "clinic_notification_controls_created_at_idx" ON "clinic_notification_controls" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_clinic_notification_occurre_fk" FOREIGN KEY ("clinic_notification_occurrences_id") REFERENCES "public"."clinic_notification_occurrences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_clinic_notification_read_re_fk" FOREIGN KEY ("clinic_notification_read_receipts_id") REFERENCES "public"."clinic_notification_read_receipts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_clinic_notification_control_fk" FOREIGN KEY ("clinic_notification_controls_id") REFERENCES "public"."clinic_notification_controls"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_clinic_notification_occurr_idx" ON "payload_locked_documents_rels" USING btree ("clinic_notification_occurrences_id");
  CREATE INDEX "payload_locked_documents_rels_clinic_notification_read_r_idx" ON "payload_locked_documents_rels" USING btree ("clinic_notification_read_receipts_id");
  CREATE INDEX "payload_locked_documents_rels_clinic_notification_contro_idx" ON "payload_locked_documents_rels" USING btree ("clinic_notification_controls_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinic_notification_occurrences" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "clinic_notification_read_receipts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "clinic_notification_controls" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "clinic_notification_occurrences" CASCADE;
  DROP TABLE "clinic_notification_read_receipts" CASCADE;
  DROP TABLE "clinic_notification_controls" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_clinic_notification_occurre_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_clinic_notification_read_re_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_clinic_notification_control_fk";
  
  DROP INDEX "payload_locked_documents_rels_clinic_notification_occurr_idx";
  DROP INDEX "payload_locked_documents_rels_clinic_notification_read_r_idx";
  DROP INDEX "payload_locked_documents_rels_clinic_notification_contro_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "clinic_notification_occurrences_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "clinic_notification_read_receipts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "clinic_notification_controls_id";
  DROP TYPE "public"."enum_clinic_notification_occurrences_source_record_kind";
  DROP TYPE "public"."enum_clinic_notification_occurrences_outcome";`)
}
