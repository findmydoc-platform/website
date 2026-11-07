import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_inquiry_preparations_environment" AS ENUM('local', 'test', 'ci', 'preview', 'production');
  CREATE TABLE "inquiry_preparations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"environment" "enum_inquiry_preparations_environment" NOT NULL,
  	"reference" varchar NOT NULL,
  	"submission_key" varchar NOT NULL,
  	"origin_attempt_key" varchar NOT NULL,
  	"group_binding" varchar NOT NULL,
  	"authorized_at" timestamp(3) with time zone NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"first_attempt_at" timestamp(3) with time zone,
  	"password_established_at" timestamp(3) with time zone,
  	"subject" varchar,
  	"patient_id" integer,
  	"auth_action_id" integer,
  	"submitted_inquiry_id" integer,
  	"clinic_id" integer,
  	"doctor_id" integer,
  	"treatment_id" integer,
  	"first_name" varchar,
  	"last_name" varchar,
  	"email" varchar,
  	"phone_number" varchar,
  	"message" varchar,
  	"preferred_contact_window" varchar,
  	"treatment_timeline" varchar,
  	"consent_text" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "inquiry_preparations" ADD CONSTRAINT "inquiry_preparations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_preparations" ADD CONSTRAINT "inquiry_preparations_auth_action_id_auth_actions_id_fk" FOREIGN KEY ("auth_action_id") REFERENCES "public"."auth_actions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_preparations" ADD CONSTRAINT "inquiry_preparations_submitted_inquiry_id_patient_clinic_inquiries_id_fk" FOREIGN KEY ("submitted_inquiry_id") REFERENCES "public"."patient_clinic_inquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_preparations" ADD CONSTRAINT "inquiry_preparations_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_preparations" ADD CONSTRAINT "inquiry_preparations_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiry_preparations" ADD CONSTRAINT "inquiry_preparations_treatment_id_treatments_id_fk" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "inquiry_preparations_reference_idx" ON "inquiry_preparations" USING btree ("reference");
  CREATE UNIQUE INDEX "inquiry_preparations_submission_key_idx" ON "inquiry_preparations" USING btree ("submission_key");
  CREATE UNIQUE INDEX "inquiry_preparations_origin_attempt_key_idx" ON "inquiry_preparations" USING btree ("origin_attempt_key");
  CREATE INDEX "inquiry_preparations_group_binding_idx" ON "inquiry_preparations" USING btree ("group_binding");
  CREATE INDEX "inquiry_preparations_expires_at_idx" ON "inquiry_preparations" USING btree ("expires_at");
  CREATE INDEX "inquiry_preparations_subject_idx" ON "inquiry_preparations" USING btree ("subject");
  CREATE INDEX "inquiry_preparations_patient_idx" ON "inquiry_preparations" USING btree ("patient_id");
  CREATE INDEX "inquiry_preparations_auth_action_idx" ON "inquiry_preparations" USING btree ("auth_action_id");
  CREATE INDEX "inquiry_preparations_submitted_inquiry_idx" ON "inquiry_preparations" USING btree ("submitted_inquiry_id");
  CREATE INDEX "inquiry_preparations_clinic_idx" ON "inquiry_preparations" USING btree ("clinic_id");
  CREATE INDEX "inquiry_preparations_doctor_idx" ON "inquiry_preparations" USING btree ("doctor_id");
  CREATE INDEX "inquiry_preparations_treatment_idx" ON "inquiry_preparations" USING btree ("treatment_id");
  CREATE INDEX "inquiry_preparations_updated_at_idx" ON "inquiry_preparations" USING btree ("updated_at");
  CREATE INDEX "inquiry_preparations_created_at_idx" ON "inquiry_preparations" USING btree ("created_at");
  CREATE INDEX "environment_groupBinding_idx" ON "inquiry_preparations" USING btree ("environment","group_binding");
  CREATE INDEX "environment_authAction_subject_idx" ON "inquiry_preparations" USING btree ("environment","auth_action_id","subject");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "inquiry_preparations" CASCADE;
  DROP TYPE "public"."enum_inquiry_preparations_environment";`)
}
