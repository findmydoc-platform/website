import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_patient_clinic_inquiries_external_references_provider" AS ENUM('hubspot', 'salesforce', 'other');
  CREATE TYPE "public"."enum_patient_clinic_inquiries_status" AS ENUM('submitted', 'in_review', 'contacted', 'closed', 'spam');
  CREATE TYPE "public"."enum_patient_clinic_inquiries_next_step" AS ENUM('platform-review', 'patient-follow-up', 'clinic-follow-up', 'no-action');
  CREATE TYPE "public"."enum_patient_clinic_inquiries_source" AS ENUM('clinic_profile', 'admin_manual', 'crm_import', 'api');
  CREATE TYPE "public"."enum_patient_clinic_inquiries_sync_status" AS ENUM('not_configured', 'pending', 'synced', 'failed');
  CREATE TABLE "patient_clinic_inquiries_external_references" (
   "_order" integer NOT NULL,
   "_parent_id" integer NOT NULL,
   "id" varchar PRIMARY KEY NOT NULL,
   "provider" "enum_patient_clinic_inquiries_external_references_provider" NOT NULL,
   "object_type" varchar NOT NULL,
   "external_id" varchar NOT NULL,
   "external_url" varchar,
   "synced_at" timestamp(3) with time zone
  );

  CREATE TABLE "patient_clinic_inquiries" (
   "id" serial PRIMARY KEY NOT NULL,
   "stable_id" varchar,
   "clinic_id" integer NOT NULL,
   "clinic_name_snapshot" varchar NOT NULL,
   "patient_id" integer,
   "full_name" varchar NOT NULL,
   "email" varchar NOT NULL,
   "phone_number" varchar NOT NULL,
   "preferred_date" timestamp(3) with time zone,
   "preferred_time" varchar,
   "doctor_id" integer,
   "doctor_name_snapshot" varchar,
   "treatment_id" integer,
   "treatment_name_snapshot" varchar,
   "message" varchar NOT NULL,
   "consent_accepted" boolean DEFAULT false NOT NULL,
   "consent_accepted_at" timestamp(3) with time zone,
   "consent_text" varchar,
   "status" "enum_patient_clinic_inquiries_status" DEFAULT 'submitted' NOT NULL,
   "next_step" "enum_patient_clinic_inquiries_next_step" DEFAULT 'platform-review',
   "assigned_to_id" integer,
   "source" "enum_patient_clinic_inquiries_source" DEFAULT 'clinic_profile' NOT NULL,
   "form_url" varchar NOT NULL,
   "source_meta_ip" varchar,
   "source_meta_user_agent" varchar,
   "sync_status" "enum_patient_clinic_inquiries_sync_status" DEFAULT 'not_configured',
   "last_sync_attempt_at" timestamp(3) with time zone,
   "last_sync_error" varchar,
   "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
   "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "patient_clinic_inquiries_id" integer;
  ALTER TABLE "patient_clinic_inquiries_external_references" ADD CONSTRAINT "patient_clinic_inquiries_external_references_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."patient_clinic_inquiries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "patient_clinic_inquiries" ADD CONSTRAINT "patient_clinic_inquiries_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "patient_clinic_inquiries" ADD CONSTRAINT "patient_clinic_inquiries_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "patient_clinic_inquiries" ADD CONSTRAINT "patient_clinic_inquiries_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "patient_clinic_inquiries" ADD CONSTRAINT "patient_clinic_inquiries_treatment_id_treatments_id_fk" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "patient_clinic_inquiries" ADD CONSTRAINT "patient_clinic_inquiries_assigned_to_id_basic_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."basic_users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "patient_clinic_inquiries_external_references_order_idx" ON "patient_clinic_inquiries_external_references" USING btree ("_order");
  CREATE INDEX "patient_clinic_inquiries_external_references_parent_id_idx" ON "patient_clinic_inquiries_external_references" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "patient_clinic_inquiries_stable_id_idx" ON "patient_clinic_inquiries" USING btree ("stable_id");
  CREATE INDEX "patient_clinic_inquiries_clinic_idx" ON "patient_clinic_inquiries" USING btree ("clinic_id");
  CREATE INDEX "patient_clinic_inquiries_patient_idx" ON "patient_clinic_inquiries" USING btree ("patient_id");
  CREATE INDEX "patient_clinic_inquiries_email_idx" ON "patient_clinic_inquiries" USING btree ("email");
  CREATE INDEX "patient_clinic_inquiries_doctor_idx" ON "patient_clinic_inquiries" USING btree ("doctor_id");
  CREATE INDEX "patient_clinic_inquiries_treatment_idx" ON "patient_clinic_inquiries" USING btree ("treatment_id");
  CREATE INDEX "patient_clinic_inquiries_assigned_to_idx" ON "patient_clinic_inquiries" USING btree ("assigned_to_id");
  CREATE INDEX "patient_clinic_inquiries_updated_at_idx" ON "patient_clinic_inquiries" USING btree ("updated_at");
  CREATE INDEX "patient_clinic_inquiries_created_at_idx" ON "patient_clinic_inquiries" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_patient_clinic_inquiries_fk" FOREIGN KEY ("patient_clinic_inquiries_id") REFERENCES "public"."patient_clinic_inquiries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_patient_clinic_inquiries_i_idx" ON "payload_locked_documents_rels" USING btree ("patient_clinic_inquiries_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "patient_clinic_inquiries_external_references" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "patient_clinic_inquiries" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "patient_clinic_inquiries_external_references" CASCADE;
  DROP TABLE "patient_clinic_inquiries" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_patient_clinic_inquiries_fk";

  DROP INDEX "payload_locked_documents_rels_patient_clinic_inquiries_i_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "patient_clinic_inquiries_id";
  DROP TYPE "public"."enum_patient_clinic_inquiries_external_references_provider";
  DROP TYPE "public"."enum_patient_clinic_inquiries_status";
  DROP TYPE "public"."enum_patient_clinic_inquiries_next_step";
  DROP TYPE "public"."enum_patient_clinic_inquiries_source";
  DROP TYPE "public"."enum_patient_clinic_inquiries_sync_status";`)
}
