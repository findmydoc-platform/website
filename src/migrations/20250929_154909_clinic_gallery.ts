import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
 CREATE TYPE "public"."enum_clinic_gallery_media_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_clinic_gallery_entries_status" AS ENUM('draft', 'published');
  CREATE TABLE "clinic_gallery_media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"description" jsonb,
  	"clinic_id" integer NOT NULL,
  	"status" "enum_clinic_gallery_media_status" DEFAULT 'draft' NOT NULL,
  	"published_at" timestamp(3) with time zone,
  	"created_by_id" integer NOT NULL,
  	"storage_key" varchar NOT NULL,
  	"storage_path" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_square_url" varchar,
  	"sizes_square_width" numeric,
  	"sizes_square_height" numeric,
  	"sizes_square_mime_type" varchar,
  	"sizes_square_filesize" numeric,
  	"sizes_square_filename" varchar,
  	"sizes_small_url" varchar,
  	"sizes_small_width" numeric,
  	"sizes_small_height" numeric,
  	"sizes_small_mime_type" varchar,
  	"sizes_small_filesize" numeric,
  	"sizes_small_filename" varchar,
  	"sizes_medium_url" varchar,
  	"sizes_medium_width" numeric,
  	"sizes_medium_height" numeric,
  	"sizes_medium_mime_type" varchar,
  	"sizes_medium_filesize" numeric,
  	"sizes_medium_filename" varchar,
  	"sizes_large_url" varchar,
  	"sizes_large_width" numeric,
  	"sizes_large_height" numeric,
  	"sizes_large_mime_type" varchar,
  	"sizes_large_filesize" numeric,
  	"sizes_large_filename" varchar,
  	"sizes_xlarge_url" varchar,
  	"sizes_xlarge_width" numeric,
  	"sizes_xlarge_height" numeric,
  	"sizes_xlarge_mime_type" varchar,
  	"sizes_xlarge_filesize" numeric,
  	"sizes_xlarge_filename" varchar,
  	"sizes_og_url" varchar,
  	"sizes_og_width" numeric,
  	"sizes_og_height" numeric,
  	"sizes_og_mime_type" varchar,
  	"sizes_og_filesize" numeric,
  	"sizes_og_filename" varchar
  );

  CREATE TABLE "clinic_gallery_entries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"clinic_id" integer NOT NULL,
  	"before_media_id" integer,
  	"after_media_id" integer,
  	"description" jsonb,
  	"status" "enum_clinic_gallery_entries_status" DEFAULT 'draft' NOT NULL,
  	"published_at" timestamp(3) with time zone,
  	"created_by_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "clinics_rels" ADD COLUMN "clinic_gallery_entries_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "clinic_gallery_media_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "clinic_gallery_entries_id" integer;
  ALTER TABLE "clinic_gallery_media" ADD CONSTRAINT "clinic_gallery_media_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "clinic_gallery_media" ADD CONSTRAINT "clinic_gallery_media_created_by_id_basic_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."basic_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "clinic_gallery_entries" ADD CONSTRAINT "clinic_gallery_entries_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "clinic_gallery_entries" ADD CONSTRAINT "clinic_gallery_entries_before_media_id_clinic_gallery_media_id_fk" FOREIGN KEY ("before_media_id") REFERENCES "public"."clinic_gallery_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "clinic_gallery_entries" ADD CONSTRAINT "clinic_gallery_entries_after_media_id_clinic_gallery_media_id_fk" FOREIGN KEY ("after_media_id") REFERENCES "public"."clinic_gallery_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "clinic_gallery_entries" ADD CONSTRAINT "clinic_gallery_entries_created_by_id_basic_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."basic_users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "clinic_gallery_media_clinic_idx" ON "clinic_gallery_media" USING btree ("clinic_id");
  CREATE INDEX "clinic_gallery_media_created_by_idx" ON "clinic_gallery_media" USING btree ("created_by_id");
  CREATE INDEX "clinic_gallery_media_updated_at_idx" ON "clinic_gallery_media" USING btree ("updated_at");
  CREATE INDEX "clinic_gallery_media_created_at_idx" ON "clinic_gallery_media" USING btree ("created_at");
  CREATE INDEX "clinic_gallery_media_deleted_at_idx" ON "clinic_gallery_media" USING btree ("deleted_at");
  CREATE UNIQUE INDEX "clinic_gallery_media_storage_key_idx" ON "clinic_gallery_media" USING btree ("storage_key");
  CREATE UNIQUE INDEX "clinic_gallery_media_filename_idx" ON "clinic_gallery_media" USING btree ("filename");
  CREATE INDEX "clinic_gallery_media_sizes_thumbnail_sizes_thumbnail_fil_idx" ON "clinic_gallery_media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "clinic_gallery_media_sizes_square_sizes_square_filename_idx" ON "clinic_gallery_media" USING btree ("sizes_square_filename");
  CREATE INDEX "clinic_gallery_media_sizes_small_sizes_small_filename_idx" ON "clinic_gallery_media" USING btree ("sizes_small_filename");
  CREATE INDEX "clinic_gallery_media_sizes_medium_sizes_medium_filename_idx" ON "clinic_gallery_media" USING btree ("sizes_medium_filename");
  CREATE INDEX "clinic_gallery_media_sizes_large_sizes_large_filename_idx" ON "clinic_gallery_media" USING btree ("sizes_large_filename");
  CREATE INDEX "clinic_gallery_media_sizes_xlarge_sizes_xlarge_filename_idx" ON "clinic_gallery_media" USING btree ("sizes_xlarge_filename");
  CREATE INDEX "clinic_gallery_media_sizes_og_sizes_og_filename_idx" ON "clinic_gallery_media" USING btree ("sizes_og_filename");
  CREATE INDEX "clinic_gallery_entries_clinic_idx" ON "clinic_gallery_entries" USING btree ("clinic_id");
  CREATE INDEX "clinic_gallery_entries_before_media_idx" ON "clinic_gallery_entries" USING btree ("before_media_id");
  CREATE INDEX "clinic_gallery_entries_after_media_idx" ON "clinic_gallery_entries" USING btree ("after_media_id");
  CREATE INDEX "clinic_gallery_entries_created_by_idx" ON "clinic_gallery_entries" USING btree ("created_by_id");
  CREATE INDEX "clinic_gallery_entries_updated_at_idx" ON "clinic_gallery_entries" USING btree ("updated_at");
  CREATE INDEX "clinic_gallery_entries_created_at_idx" ON "clinic_gallery_entries" USING btree ("created_at");
  ALTER TABLE "clinics_rels" ADD CONSTRAINT "clinics_rels_clinic_gallery_entries_fk" FOREIGN KEY ("clinic_gallery_entries_id") REFERENCES "public"."clinic_gallery_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_clinic_gallery_media_fk" FOREIGN KEY ("clinic_gallery_media_id") REFERENCES "public"."clinic_gallery_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_clinic_gallery_entries_fk" FOREIGN KEY ("clinic_gallery_entries_id") REFERENCES "public"."clinic_gallery_entries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "clinics_rels_clinic_gallery_entries_id_idx" ON "clinics_rels" USING btree ("clinic_gallery_entries_id");
  CREATE INDEX "payload_locked_documents_rels_clinic_gallery_media_id_idx" ON "payload_locked_documents_rels" USING btree ("clinic_gallery_media_id");
  CREATE INDEX "payload_locked_documents_rels_clinic_gallery_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("clinic_gallery_entries_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinic_gallery_media" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "clinic_gallery_entries" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "clinic_gallery_media" CASCADE;
  DROP TABLE "clinic_gallery_entries" CASCADE;
  ALTER TABLE "clinics_rels" DROP CONSTRAINT "clinics_rels_clinic_gallery_entries_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_clinic_gallery_media_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_clinic_gallery_entries_fk";

  DROP INDEX "clinics_rels_clinic_gallery_entries_id_idx";
  DROP INDEX "payload_locked_documents_rels_clinic_gallery_media_id_idx";
  DROP INDEX "payload_locked_documents_rels_clinic_gallery_entries_id_idx";
  ALTER TABLE "clinics_rels" DROP COLUMN "clinic_gallery_entries_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "clinic_gallery_media_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "clinic_gallery_entries_id";
  DROP TYPE "public"."enum_clinic_gallery_media_status";
  DROP TYPE "public"."enum_clinic_gallery_entries_status";`)
}
