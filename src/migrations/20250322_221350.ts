import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_doctors_title" AS ENUM('dr_med', 'prof_dr_med', 'pd_dr_med');
  CREATE TYPE "public"."enum_doctors_specialization" AS ENUM('orthopedics', 'sports_medicine', 'surgery', 'physiotherapy');
  CREATE TABLE IF NOT EXISTS "clinics" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"founding_year" numeric NOT NULL,
  	"country" varchar NOT NULL,
  	"city" varchar NOT NULL,
  	"street" varchar NOT NULL,
  	"zip_code" varchar NOT NULL,
  	"thumbnail_id" integer,
  	"contact_email" varchar NOT NULL,
  	"contact_phone" varchar NOT NULL,
  	"contact_website" varchar,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "clinics_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"doctors_id" integer
  );
  
  CREATE TABLE IF NOT EXISTS "doctors" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"full_name" varchar NOT NULL,
  	"title" "enum_doctors_title",
  	"clinic_id" integer NOT NULL,
  	"specialization" "enum_doctors_specialization" NOT NULL,
  	"contact_email" varchar NOT NULL,
  	"contact_phone" varchar,
  	"image_id" integer,
  	"biography" jsonb,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "clinics_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "doctors_id" integer;
  DO $$ BEGIN
   ALTER TABLE "clinics" ADD CONSTRAINT "clinics_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "clinics_rels" ADD CONSTRAINT "clinics_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "clinics_rels" ADD CONSTRAINT "clinics_rels_doctors_fk" FOREIGN KEY ("doctors_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "doctors" ADD CONSTRAINT "doctors_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "doctors" ADD CONSTRAINT "doctors_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "clinics_thumbnail_idx" ON "clinics" USING btree ("thumbnail_id");
  CREATE INDEX IF NOT EXISTS "clinics_updated_at_idx" ON "clinics" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "clinics_created_at_idx" ON "clinics" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "clinics_rels_order_idx" ON "clinics_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "clinics_rels_parent_idx" ON "clinics_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "clinics_rels_path_idx" ON "clinics_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "clinics_rels_doctors_id_idx" ON "clinics_rels" USING btree ("doctors_id");
  CREATE INDEX IF NOT EXISTS "doctors_clinic_idx" ON "doctors" USING btree ("clinic_id");
  CREATE INDEX IF NOT EXISTS "doctors_image_idx" ON "doctors" USING btree ("image_id");
  CREATE INDEX IF NOT EXISTS "doctors_updated_at_idx" ON "doctors" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "doctors_created_at_idx" ON "doctors" USING btree ("created_at");
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_clinics_fk" FOREIGN KEY ("clinics_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_doctors_fk" FOREIGN KEY ("doctors_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_clinics_id_idx" ON "payload_locked_documents_rels" USING btree ("clinics_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_doctors_id_idx" ON "payload_locked_documents_rels" USING btree ("doctors_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinics" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "clinics_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "doctors" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "clinics" CASCADE;
  DROP TABLE "clinics_rels" CASCADE;
  DROP TABLE "doctors" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_clinics_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_doctors_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_clinics_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_doctors_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "clinics_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "doctors_id";
  DROP TYPE "public"."enum_doctors_title";
  DROP TYPE "public"."enum_doctors_specialization";`)
}
