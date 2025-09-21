import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_clinic_applications_status" AS ENUM('submitted', 'approved', 'rejected');
  CREATE TABLE "clinic_applications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"clinic_name" varchar NOT NULL,
  	"contact_first_name" varchar NOT NULL,
  	"contact_last_name" varchar NOT NULL,
  	"contact_email" varchar NOT NULL,
  	"contact_phone" varchar,
  	"address_street" varchar NOT NULL,
  	"address_house_number" varchar NOT NULL,
  	"address_zip_code" numeric NOT NULL,
  	"address_city" varchar NOT NULL,
  	"address_country" varchar DEFAULT 'Turkey' NOT NULL,
  	"additional_notes" varchar,
  	"status" "enum_clinic_applications_status" DEFAULT 'submitted' NOT NULL,
  	"review_notes" varchar,
  "linked_records_clinic_id" integer,
  "linked_records_basic_user_id" integer,
  "linked_records_clinic_staff_id" integer,
  "linked_records_processed_at" timestamp(3) with time zone,
  	"source_meta_ip" varchar,
  	"source_meta_user_agent" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "clinic_applications_id" integer;
  ALTER TABLE "clinic_applications" ADD CONSTRAINT "clinic_applications_linked_records_clinic_id_clinics_id_fk" FOREIGN KEY ("linked_records_clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "clinic_applications" ADD CONSTRAINT "clinic_applications_linked_records_basic_user_id_basic_users_id_fk" FOREIGN KEY ("linked_records_basic_user_id") REFERENCES "public"."basic_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "clinic_applications" ADD CONSTRAINT "clinic_applications_linked_records_clinic_staff_id_clinic_staff_id_fk" FOREIGN KEY ("linked_records_clinic_staff_id") REFERENCES "public"."clinic_staff"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "clinic_applications_clinic_name_idx" ON "clinic_applications" USING btree ("clinic_name");
  CREATE INDEX "clinic_applications_contact_email_idx" ON "clinic_applications" USING btree ("contact_email");
  CREATE INDEX "clinic_applications_linked_records_linked_records_clinic_idx" ON "clinic_applications" USING btree ("linked_records_clinic_id");
  CREATE INDEX "clinic_applications_linked_records_linked_records_basic__idx" ON "clinic_applications" USING btree ("linked_records_basic_user_id");
  CREATE INDEX "clinic_applications_linked_records_linked_records_clin_1_idx" ON "clinic_applications" USING btree ("linked_records_clinic_staff_id");
  CREATE INDEX "clinic_applications_updated_at_idx" ON "clinic_applications" USING btree ("updated_at");
  CREATE INDEX "clinic_applications_created_at_idx" ON "clinic_applications" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_clinic_applications_fk" FOREIGN KEY ("clinic_applications_id") REFERENCES "public"."clinic_applications"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_clinic_applications_id_idx" ON "payload_locked_documents_rels" USING btree ("clinic_applications_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinic_applications" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "clinic_applications" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_clinic_applications_fk";

  DROP INDEX "payload_locked_documents_rels_clinic_applications_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "clinic_applications_id";
  DROP TYPE "public"."enum_clinic_applications_status";`)
}
