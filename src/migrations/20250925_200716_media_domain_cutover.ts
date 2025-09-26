import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
	CREATE TABLE "platform_content_media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"caption" jsonb,
  	"created_by_id" integer NOT NULL,
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

	CREATE TABLE "doctor_media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"caption" jsonb,
  	"doctor_id" integer NOT NULL,
  	"clinic_id" integer NOT NULL,
  	"created_by_id" integer NOT NULL,
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

	CREATE TABLE "user_profile_media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"caption" jsonb,
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

  CREATE TABLE "user_profile_media_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"basic_users_id" integer,
  	"patients_id" integer
  );

	ALTER TABLE "media" DISABLE ROW LEVEL SECURITY;
	-- Keep DROP TABLE CASCADE to remove old FKs automatically; explicit DROP CONSTRAINT lines removed as redundant
	DROP TABLE "media" CASCADE;
	-- Removed explicit DROP CONSTRAINT statements for old media FKs (they were failing because CASCADE already removed them)
	-- Removed DROP CONSTRAINT payload_locked_documents_rels_media_fk (also handled by CASCADE)
	DROP INDEX "payload_locked_documents_rels_media_id_idx";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "platform_content_media_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "doctor_media_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "user_profile_media_id" integer;
  ALTER TABLE "platform_content_media" ADD CONSTRAINT "platform_content_media_created_by_id_basic_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."basic_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "doctor_media" ADD CONSTRAINT "doctor_media_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "doctor_media" ADD CONSTRAINT "doctor_media_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "doctor_media" ADD CONSTRAINT "doctor_media_created_by_id_basic_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."basic_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_profile_media_rels" ADD CONSTRAINT "user_profile_media_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."user_profile_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "user_profile_media_rels" ADD CONSTRAINT "user_profile_media_rels_basic_users_fk" FOREIGN KEY ("basic_users_id") REFERENCES "public"."basic_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "user_profile_media_rels" ADD CONSTRAINT "user_profile_media_rels_patients_fk" FOREIGN KEY ("patients_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "platform_content_media_created_by_idx" ON "platform_content_media" USING btree ("created_by_id");
  CREATE INDEX "platform_content_media_updated_at_idx" ON "platform_content_media" USING btree ("updated_at");
  CREATE INDEX "platform_content_media_created_at_idx" ON "platform_content_media" USING btree ("created_at");
  CREATE INDEX "platform_content_media_deleted_at_idx" ON "platform_content_media" USING btree ("deleted_at");
  CREATE UNIQUE INDEX "platform_content_media_filename_idx" ON "platform_content_media" USING btree ("filename");
  CREATE INDEX "platform_content_media_sizes_thumbnail_sizes_thumbnail_f_idx" ON "platform_content_media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "platform_content_media_sizes_square_sizes_square_filenam_idx" ON "platform_content_media" USING btree ("sizes_square_filename");
  CREATE INDEX "platform_content_media_sizes_small_sizes_small_filename_idx" ON "platform_content_media" USING btree ("sizes_small_filename");
  CREATE INDEX "platform_content_media_sizes_medium_sizes_medium_filenam_idx" ON "platform_content_media" USING btree ("sizes_medium_filename");
  CREATE INDEX "platform_content_media_sizes_large_sizes_large_filename_idx" ON "platform_content_media" USING btree ("sizes_large_filename");
  CREATE INDEX "platform_content_media_sizes_xlarge_sizes_xlarge_filenam_idx" ON "platform_content_media" USING btree ("sizes_xlarge_filename");
  CREATE INDEX "platform_content_media_sizes_og_sizes_og_filename_idx" ON "platform_content_media" USING btree ("sizes_og_filename");
  CREATE INDEX "doctor_media_doctor_idx" ON "doctor_media" USING btree ("doctor_id");
  CREATE INDEX "doctor_media_clinic_idx" ON "doctor_media" USING btree ("clinic_id");
  CREATE INDEX "doctor_media_created_by_idx" ON "doctor_media" USING btree ("created_by_id");
  CREATE INDEX "doctor_media_updated_at_idx" ON "doctor_media" USING btree ("updated_at");
  CREATE INDEX "doctor_media_created_at_idx" ON "doctor_media" USING btree ("created_at");
  CREATE INDEX "doctor_media_deleted_at_idx" ON "doctor_media" USING btree ("deleted_at");
  CREATE UNIQUE INDEX "doctor_media_filename_idx" ON "doctor_media" USING btree ("filename");
  CREATE INDEX "doctor_media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "doctor_media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "doctor_media_sizes_square_sizes_square_filename_idx" ON "doctor_media" USING btree ("sizes_square_filename");
  CREATE INDEX "doctor_media_sizes_small_sizes_small_filename_idx" ON "doctor_media" USING btree ("sizes_small_filename");
  CREATE INDEX "doctor_media_sizes_medium_sizes_medium_filename_idx" ON "doctor_media" USING btree ("sizes_medium_filename");
  CREATE INDEX "doctor_media_sizes_large_sizes_large_filename_idx" ON "doctor_media" USING btree ("sizes_large_filename");
  CREATE INDEX "doctor_media_sizes_xlarge_sizes_xlarge_filename_idx" ON "doctor_media" USING btree ("sizes_xlarge_filename");
  CREATE INDEX "doctor_media_sizes_og_sizes_og_filename_idx" ON "doctor_media" USING btree ("sizes_og_filename");
  CREATE INDEX "user_profile_media_updated_at_idx" ON "user_profile_media" USING btree ("updated_at");
  CREATE INDEX "user_profile_media_created_at_idx" ON "user_profile_media" USING btree ("created_at");
  CREATE INDEX "user_profile_media_deleted_at_idx" ON "user_profile_media" USING btree ("deleted_at");
  CREATE UNIQUE INDEX "user_profile_media_filename_idx" ON "user_profile_media" USING btree ("filename");
  CREATE INDEX "user_profile_media_sizes_thumbnail_sizes_thumbnail_filen_idx" ON "user_profile_media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "user_profile_media_sizes_square_sizes_square_filename_idx" ON "user_profile_media" USING btree ("sizes_square_filename");
  CREATE INDEX "user_profile_media_sizes_small_sizes_small_filename_idx" ON "user_profile_media" USING btree ("sizes_small_filename");
  CREATE INDEX "user_profile_media_sizes_medium_sizes_medium_filename_idx" ON "user_profile_media" USING btree ("sizes_medium_filename");
  CREATE INDEX "user_profile_media_sizes_large_sizes_large_filename_idx" ON "user_profile_media" USING btree ("sizes_large_filename");
  CREATE INDEX "user_profile_media_sizes_xlarge_sizes_xlarge_filename_idx" ON "user_profile_media" USING btree ("sizes_xlarge_filename");
  CREATE INDEX "user_profile_media_sizes_og_sizes_og_filename_idx" ON "user_profile_media" USING btree ("sizes_og_filename");
  CREATE INDEX "user_profile_media_rels_order_idx" ON "user_profile_media_rels" USING btree ("order");
  CREATE INDEX "user_profile_media_rels_parent_idx" ON "user_profile_media_rels" USING btree ("parent_id");
  CREATE INDEX "user_profile_media_rels_path_idx" ON "user_profile_media_rels" USING btree ("path");
  CREATE INDEX "user_profile_media_rels_basic_users_id_idx" ON "user_profile_media_rels" USING btree ("basic_users_id");
  CREATE INDEX "user_profile_media_rels_patients_id_idx" ON "user_profile_media_rels" USING btree ("patients_id");
  ALTER TABLE "pages_blocks_content_columns" ADD CONSTRAINT "pages_blocks_content_columns_image_id_platform_content_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_media_block" ADD CONSTRAINT "pages_blocks_media_block_media_id_platform_content_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_benefits_block_cards" ADD CONSTRAINT "pages_blocks_benefits_block_cards_image_id_platform_content_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_hero_media_id_platform_content_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_meta_image_id_platform_content_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_content_columns" ADD CONSTRAINT "_pages_v_blocks_content_columns_image_id_platform_content_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_media_block" ADD CONSTRAINT "_pages_v_blocks_media_block_media_id_platform_content_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_benefits_block_cards" ADD CONSTRAINT "_pages_v_blocks_benefits_block_cards_image_id_platform_content_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_hero_media_id_platform_content_media_id_fk" FOREIGN KEY ("version_hero_media_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_meta_image_id_platform_content_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_hero_image_id_platform_content_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_meta_image_id_platform_content_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_hero_image_id_platform_content_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_meta_image_id_platform_content_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "basic_users" ADD CONSTRAINT "basic_users_profile_image_id_user_profile_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."user_profile_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "patients" ADD CONSTRAINT "patients_profile_image_id_user_profile_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."user_profile_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "doctors" ADD CONSTRAINT "doctors_profile_image_id_doctor_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."doctor_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "accreditation" ADD CONSTRAINT "accreditation_icon_id_platform_content_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "medical_specialties" ADD CONSTRAINT "medical_specialties_icon_id_platform_content_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "search" ADD CONSTRAINT "search_meta_image_id_platform_content_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_platform_content_media_fk" FOREIGN KEY ("platform_content_media_id") REFERENCES "public"."platform_content_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_doctor_media_fk" FOREIGN KEY ("doctor_media_id") REFERENCES "public"."doctor_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_user_profile_media_fk" FOREIGN KEY ("user_profile_media_id") REFERENCES "public"."user_profile_media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_platform_content_media_id_idx" ON "payload_locked_documents_rels" USING btree ("platform_content_media_id");
  CREATE INDEX "payload_locked_documents_rels_doctor_media_id_idx" ON "payload_locked_documents_rels" USING btree ("doctor_media_id");
  CREATE INDEX "payload_locked_documents_rels_user_profile_media_id_idx" ON "payload_locked_documents_rels" USING btree ("user_profile_media_id");
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "media_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"caption" jsonb,
  	"prefix" varchar,
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

	ALTER TABLE "platform_content_media" DISABLE ROW LEVEL SECURITY;
	ALTER TABLE "doctor_media" DISABLE ROW LEVEL SECURITY;
	ALTER TABLE "user_profile_media" DISABLE ROW LEVEL SECURITY;
	ALTER TABLE "user_profile_media_rels" DISABLE ROW LEVEL SECURITY;
	-- Use CASCADE to remove FKs to new media tables; remove explicit DROP CONSTRAINT lines
	DROP TABLE "platform_content_media" CASCADE;
	DROP TABLE "doctor_media" CASCADE;
	DROP TABLE "user_profile_media" CASCADE;
	DROP TABLE "user_profile_media_rels" CASCADE;
	-- Removed redundant DROP CONSTRAINT statements for platform_content_media/doctor_media/user_profile_media FKs
	DROP INDEX "payload_locked_documents_rels_platform_content_media_id_idx";
	DROP INDEX "payload_locked_documents_rels_doctor_media_id_idx";
	DROP INDEX "payload_locked_documents_rels_user_profile_media_id_idx";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "media_id" integer;
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE INDEX "media_deleted_at_idx" ON "media" USING btree ("deleted_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_square_sizes_square_filename_idx" ON "media" USING btree ("sizes_square_filename");
  CREATE INDEX "media_sizes_small_sizes_small_filename_idx" ON "media" USING btree ("sizes_small_filename");
  CREATE INDEX "media_sizes_medium_sizes_medium_filename_idx" ON "media" USING btree ("sizes_medium_filename");
  CREATE INDEX "media_sizes_large_sizes_large_filename_idx" ON "media" USING btree ("sizes_large_filename");
  CREATE INDEX "media_sizes_xlarge_sizes_xlarge_filename_idx" ON "media" USING btree ("sizes_xlarge_filename");
  CREATE INDEX "media_sizes_og_sizes_og_filename_idx" ON "media" USING btree ("sizes_og_filename");
  ALTER TABLE "pages_blocks_content_columns" ADD CONSTRAINT "pages_blocks_content_columns_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_media_block" ADD CONSTRAINT "pages_blocks_media_block_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_benefits_block_cards" ADD CONSTRAINT "pages_blocks_benefits_block_cards_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_content_columns" ADD CONSTRAINT "_pages_v_blocks_content_columns_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_media_block" ADD CONSTRAINT "_pages_v_blocks_media_block_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_benefits_block_cards" ADD CONSTRAINT "_pages_v_blocks_benefits_block_cards_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_hero_media_id_media_id_fk" FOREIGN KEY ("version_hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_hero_image_id_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "basic_users" ADD CONSTRAINT "basic_users_profile_image_id_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "patients" ADD CONSTRAINT "patients_profile_image_id_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "doctors" ADD CONSTRAINT "doctors_profile_image_id_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "accreditation" ADD CONSTRAINT "accreditation_icon_id_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "medical_specialties" ADD CONSTRAINT "medical_specialties_icon_id_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "search" ADD CONSTRAINT "search_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "platform_content_media_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "doctor_media_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "user_profile_media_id";`)
}
