import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_clinic_profile_drafts_supported_languages" AS ENUM('german', 'english', 'french', 'spanish', 'italian', 'turkish', 'russian', 'arabic', 'chinese', 'japanese', 'korean', 'portuguese');
  CREATE TABLE "clinic_profile_drafts_supported_languages" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_clinic_profile_drafts_supported_languages",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "clinic_profile_drafts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"clinic_id" integer NOT NULL,
  	"base_published_revision" numeric NOT NULL,
  	"revision" numeric NOT NULL,
  	"name" varchar,
  	"description" jsonb,
  	"address_country_id" integer NOT NULL,
  	"address_street" varchar,
  	"address_house_number" varchar,
  	"address_zip_code" varchar,
  	"address_city_id" integer,
  	"opening_hours_monday_is_closed" boolean,
  	"opening_hours_monday_opens_at" varchar,
  	"opening_hours_monday_closes_at" varchar,
  	"opening_hours_tuesday_is_closed" boolean,
  	"opening_hours_tuesday_opens_at" varchar,
  	"opening_hours_tuesday_closes_at" varchar,
  	"opening_hours_wednesday_is_closed" boolean,
  	"opening_hours_wednesday_opens_at" varchar,
  	"opening_hours_wednesday_closes_at" varchar,
  	"opening_hours_thursday_is_closed" boolean,
  	"opening_hours_thursday_opens_at" varchar,
  	"opening_hours_thursday_closes_at" varchar,
  	"opening_hours_friday_is_closed" boolean,
  	"opening_hours_friday_opens_at" varchar,
  	"opening_hours_friday_closes_at" varchar,
  	"opening_hours_saturday_is_closed" boolean,
  	"opening_hours_saturday_opens_at" varchar,
  	"opening_hours_saturday_closes_at" varchar,
  	"opening_hours_sunday_is_closed" boolean,
  	"opening_hours_sunday_opens_at" varchar,
  	"opening_hours_sunday_closes_at" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "clinics" ADD COLUMN "profile_revision" numeric DEFAULT 0;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "clinic_profile_drafts_id" integer;
  ALTER TABLE "clinic_profile_drafts_supported_languages" ADD CONSTRAINT "clinic_profile_drafts_supported_languages_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."clinic_profile_drafts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clinic_profile_drafts" ADD CONSTRAINT "clinic_profile_drafts_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "clinic_profile_drafts" ADD CONSTRAINT "clinic_profile_drafts_address_country_id_countries_id_fk" FOREIGN KEY ("address_country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "clinic_profile_drafts" ADD CONSTRAINT "clinic_profile_drafts_address_city_id_cities_id_fk" FOREIGN KEY ("address_city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "clinic_profile_drafts_supported_languages_order_idx" ON "clinic_profile_drafts_supported_languages" USING btree ("order");
  CREATE INDEX "clinic_profile_drafts_supported_languages_parent_idx" ON "clinic_profile_drafts_supported_languages" USING btree ("parent_id");
  CREATE INDEX "clinic_profile_drafts_clinic_idx" ON "clinic_profile_drafts" USING btree ("clinic_id");
  CREATE INDEX "clinic_profile_drafts_address_address_country_idx" ON "clinic_profile_drafts" USING btree ("address_country_id");
  CREATE INDEX "clinic_profile_drafts_address_address_city_idx" ON "clinic_profile_drafts" USING btree ("address_city_id");
  CREATE INDEX "clinic_profile_drafts_updated_at_idx" ON "clinic_profile_drafts" USING btree ("updated_at");
  CREATE INDEX "clinic_profile_drafts_created_at_idx" ON "clinic_profile_drafts" USING btree ("created_at");
  CREATE UNIQUE INDEX "clinic_idx" ON "clinic_profile_drafts" USING btree ("clinic_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_clinic_profile_drafts_fk" FOREIGN KEY ("clinic_profile_drafts_id") REFERENCES "public"."clinic_profile_drafts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_clinic_profile_drafts_id_idx" ON "payload_locked_documents_rels" USING btree ("clinic_profile_drafts_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_clinic_profile_drafts_fk";
  DROP INDEX "payload_locked_documents_rels_clinic_profile_drafts_id_idx";
  ALTER TABLE "clinics" DROP COLUMN "profile_revision";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "clinic_profile_drafts_id";
  ALTER TABLE "clinic_profile_drafts_supported_languages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "clinic_profile_drafts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "clinic_profile_drafts_supported_languages" CASCADE;
  DROP TABLE "clinic_profile_drafts" CASCADE;
  DROP TYPE "public"."enum_clinic_profile_drafts_supported_languages";`)
}
