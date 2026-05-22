import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_patient_clinic_inquiries_treatment_timeline" AS ENUM('as_soon_as_possible', 'within_two_weeks', 'within_one_month', 'flexible');
  CREATE TYPE "public"."enum_patient_clinic_inquiries_preferred_contact_window" AS ENUM('as_soon_as_possible', 'morning', 'afternoon', 'evening', 'no_preference');
  CREATE TYPE "public"."enum_patient_clinic_inquiries_status" AS ENUM('submitted', 'in_review', 'contacted', 'closed', 'spam');
  CREATE TABLE "patient_clinic_inquiries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"clinic_id" integer NOT NULL,
  	"full_name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"phone_number" varchar NOT NULL,
  	"treatment_timeline" "enum_patient_clinic_inquiries_treatment_timeline",
  	"preferred_contact_window" "enum_patient_clinic_inquiries_preferred_contact_window",
  	"doctor_id" integer,
  	"treatment_id" integer,
  	"message" varchar NOT NULL,
  	"consent_accepted" boolean DEFAULT false NOT NULL,
  	"consent_accepted_at" timestamp(3) with time zone,
  	"consent_text" varchar,
  	"status" "enum_patient_clinic_inquiries_status" DEFAULT 'submitted' NOT NULL,
  	"assigned_to_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "patient_clinic_inquiries_id" integer;
  ALTER TABLE "patient_clinic_inquiries" ADD CONSTRAINT "patient_clinic_inquiries_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "patient_clinic_inquiries" ADD CONSTRAINT "patient_clinic_inquiries_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "patient_clinic_inquiries" ADD CONSTRAINT "patient_clinic_inquiries_treatment_id_treatments_id_fk" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "patient_clinic_inquiries" ADD CONSTRAINT "patient_clinic_inquiries_assigned_to_id_basic_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."basic_users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "patient_clinic_inquiries_clinic_idx" ON "patient_clinic_inquiries" USING btree ("clinic_id");
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
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_patient_clinic_inquiries_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_patient_clinic_inquiries_i_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "patient_clinic_inquiries_id";
  ALTER TABLE IF EXISTS "patient_clinic_inquiries" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "patient_clinic_inquiries" CASCADE;
  DROP TYPE IF EXISTS "public"."enum_patient_clinic_inquiries_treatment_timeline";
  DROP TYPE IF EXISTS "public"."enum_patient_clinic_inquiries_preferred_contact_window";
  DROP TYPE IF EXISTS "public"."enum_patient_clinic_inquiries_status";`)
}
