import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    CREATE TYPE "public"."enum_imports_import_mode" AS ENUM('create', 'update', 'upsert');
   EXCEPTION
    WHEN duplicate_object THEN null;
   END $$;
   
   DO $$ BEGIN
    CREATE TYPE "public"."enum_imports_status" AS ENUM('pending', 'completed', 'partial', 'failed');
   EXCEPTION
    WHEN duplicate_object THEN null;
   END $$;
   
   CREATE TABLE IF NOT EXISTS "imports" (
   	"id" serial PRIMARY KEY NOT NULL,
   	"collection_slug" varchar NOT NULL,
   	"import_mode" "enum_imports_import_mode",
   	"match_field" varchar,
   	"status" "enum_imports_status",
   	"summary" jsonb,
   	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
   	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
   	"url" varchar,
   	"thumbnail_u_r_l" varchar,
   	"filename" varchar,
   	"mime_type" varchar,
   	"filesize" numeric,
   	"width" numeric,
   	"height" numeric,
   	"focal_x" numeric,
   	"focal_y" numeric
   );
   
   CREATE TABLE IF NOT EXISTS "imports_texts" (
   	"id" serial PRIMARY KEY NOT NULL,
   	"order" integer NOT NULL,
   	"parent_id" integer NOT NULL,
   	"path" varchar NOT NULL,
   	"text" varchar
   );
   
   DO $$ BEGIN
    ALTER TABLE "imports_texts" ADD CONSTRAINT "imports_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;
   EXCEPTION
    WHEN duplicate_object THEN null;
   END $$;
   
   CREATE INDEX IF NOT EXISTS "imports_updated_at_idx" ON "imports" USING btree ("updated_at");
   CREATE INDEX IF NOT EXISTS "imports_created_at_idx" ON "imports" USING btree ("created_at");
   CREATE INDEX IF NOT EXISTS "imports_filename_idx" ON "imports" USING btree ("filename");
   CREATE UNIQUE INDEX IF NOT EXISTS "imports_texts_order_parent_idx" ON "imports_texts" USING btree ("order","parent_id");
   
   DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "imports_id" integer;
   EXCEPTION
    WHEN duplicate_column THEN null;
   END $$;
   
   DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_imports_fk" FOREIGN KEY ("imports_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;
   EXCEPTION
    WHEN duplicate_object THEN null;
   END $$;
   
   CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_imports_id_idx" ON "payload_locked_documents_rels" USING btree ("imports_id");
   
   -- Update task slug enum to include createCollectionImport
   DO $$ BEGIN
    ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'createCollectionImport';
   EXCEPTION
    WHEN duplicate_object THEN null;
   END $$;
   
   DO $$ BEGIN
    ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'createCollectionImport';
   EXCEPTION
    WHEN duplicate_object THEN null;
   END $$;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "payload_locked_documents_rels_imports_id_idx";
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_imports_fk";
   ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "imports_id";
   
   DROP INDEX IF EXISTS "imports_texts_order_parent_idx";
   DROP INDEX IF EXISTS "imports_filename_idx";
   DROP INDEX IF EXISTS "imports_created_at_idx";
   DROP INDEX IF EXISTS "imports_updated_at_idx";
   
   ALTER TABLE "imports_texts" DROP CONSTRAINT IF EXISTS "imports_texts_parent_fk";
   
   DROP TABLE IF EXISTS "imports_texts";
   DROP TABLE IF EXISTS "imports";
   
   DROP TYPE IF EXISTS "public"."enum_imports_status";
   DROP TYPE IF EXISTS "public"."enum_imports_import_mode";
   
   -- Note: Cannot remove enum values from existing types in PostgreSQL
   -- The enum values 'createCollectionImport' will remain in the task_slug enums
  `)
}
