import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Manual adjustment: removed unrelated ALTER on exports.format that was captured from local schema drift.
  // This migration should only introduce breadcrumbs storage for medical_specialties nested docs.
  await db.execute(sql`
   CREATE TABLE "medical_specialties_breadcrumbs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"doc_id" integer,
  	"url" varchar,
  	"label" varchar
  );
  ALTER TABLE "medical_specialties_breadcrumbs" ADD CONSTRAINT "medical_specialties_breadcrumbs_doc_id_medical_specialties_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."medical_specialties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "medical_specialties_breadcrumbs" ADD CONSTRAINT "medical_specialties_breadcrumbs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."medical_specialties"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "medical_specialties_breadcrumbs_order_idx" ON "medical_specialties_breadcrumbs" USING btree ("_order");
  CREATE INDEX "medical_specialties_breadcrumbs_parent_id_idx" ON "medical_specialties_breadcrumbs" USING btree ("_parent_id");
  CREATE INDEX "medical_specialties_breadcrumbs_doc_idx" ON "medical_specialties_breadcrumbs" USING btree ("doc_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "medical_specialties_breadcrumbs" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "medical_specialties_breadcrumbs" CASCADE;`)
}
