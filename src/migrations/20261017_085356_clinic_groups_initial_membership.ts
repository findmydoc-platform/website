import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "clinic_groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"stable_id" varchar,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "clinics" ADD COLUMN "group_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "clinic_groups_id" integer;
  CREATE UNIQUE INDEX "clinic_groups_stable_id_idx" ON "clinic_groups" USING btree ("stable_id");
  CREATE INDEX "clinic_groups_updated_at_idx" ON "clinic_groups" USING btree ("updated_at");
  CREATE INDEX "clinic_groups_created_at_idx" ON "clinic_groups" USING btree ("created_at");
  ALTER TABLE "clinics" ADD CONSTRAINT "clinics_group_id_clinic_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."clinic_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_clinic_groups_fk" FOREIGN KEY ("clinic_groups_id") REFERENCES "public"."clinic_groups"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "clinics_group_idx" ON "clinics" USING btree ("group_id");
  CREATE INDEX "payload_locked_documents_rels_clinic_groups_id_idx" ON "payload_locked_documents_rels" USING btree ("clinic_groups_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinics" DROP CONSTRAINT "clinics_group_id_clinic_groups_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_clinic_groups_fk";
  
  DROP INDEX "clinics_group_idx";
  DROP INDEX "payload_locked_documents_rels_clinic_groups_id_idx";
  ALTER TABLE "clinics" DROP COLUMN "group_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "clinic_groups_id";
  DROP TABLE "clinic_groups";`)
}
